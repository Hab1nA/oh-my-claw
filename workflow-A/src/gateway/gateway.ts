import { createHash } from 'node:crypto';
import type { Duplex } from 'node:stream';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { AgentRuntimeImpl } from '../agent/runtime.js';
import { OpenAICompatibleModelCaller } from '../agent/model/caller.js';
import { SessionManager } from '../agent/session/manager.js';
import { ToolRegistry } from '../tools/registry.js';
import { registerBuiltInTools } from '../tools/builtins/index.js';
import type { Message } from '../shared/types.js';
import type { GatewayConfig } from './config/types.js';
import { Logger } from './utils/logger.js';

export class Gateway {
  private readonly logger = Logger.getInstance();
  private readonly server: Server;
  private readonly runtime: AgentRuntimeImpl;

  constructor(private readonly config: GatewayConfig) {
    const sessionManager = new SessionManager(config.memory);
    const toolRegistry = new ToolRegistry({
      timeout: config.tools.timeout,
      allowedPaths: config.tools.allowedPaths,
      blockedCommands: config.tools.blockedCommands
    });
    registerBuiltInTools(toolRegistry);
    const modelCaller = new OpenAICompatibleModelCaller(config.agent);
    this.runtime = new AgentRuntimeImpl({
      sessionManager,
      toolRegistry,
      modelCaller,
      config
    });
    this.server = createServer((req, res) => void this.handleHttp(req, res));
    this.server.on('upgrade', (req, socket) => this.handleWebSocket(req, socket));
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(this.config.port, this.config.host, () => {
        this.server.off('error', reject);
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  private async handleHttp(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    try {
      if (req.method === 'GET' && url.pathname === '/health') {
        this.sendJson(res, 200, { status: 'ok', service: 'openclaw-minimal-gateway' });
        return;
      }

      if (req.method === 'GET' && url.pathname.startsWith('/sessions/')) {
        const sessionId = url.pathname.split('/')[2];
        this.sendJson(res, 200, await this.runtime.getSessionState(sessionId));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/v1/messages') {
        const body = await readJsonBody(req);
        const sessionId = String(body.sessionId ?? 'default');
        const content = String(body.message ?? body.content ?? '');
        const message: Message = {
          id: String(body.messageId ?? cryptoRandomId()),
          role: 'user',
          content,
          timestamp: new Date(),
          metadata: asRecord(body.metadata)
        };
        const response = await this.runtime.processMessage(sessionId, message);
        this.sendJson(res, 200, response);
        return;
      }

      this.sendJson(res, 404, { error: 'Not Found' });
    } catch (error) {
      this.logger.error('HTTP request failed', { error: String(error) });
      this.sendJson(res, 500, { error: String(error) });
    }
  }

  private handleWebSocket(req: IncomingMessage, socket: Duplex): void {
    const key = req.headers['sec-websocket-key'];
    if (typeof key !== 'string') {
      socket.destroy();
      return;
    }

    const accept = createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');
    socket.write(
      [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${accept}`,
        '',
        ''
      ].join('\r\n')
    );

    socket.on('data', (chunk) => {
      void this.handleWebSocketFrame(socket, chunk);
    });
  }

  private async handleWebSocketFrame(socket: Duplex, chunk: Buffer): Promise<void> {
    try {
      const text = decodeWebSocketTextFrame(chunk);
      const body = JSON.parse(text) as Record<string, unknown>;
      const sessionId = String(body.sessionId ?? 'default');
      const message: Message = {
        id: String(body.messageId ?? cryptoRandomId()),
        role: 'user',
        content: String(body.message ?? body.content ?? ''),
        timestamp: new Date(),
        metadata: asRecord(body.metadata)
      };
      const response = await this.runtime.processMessage(sessionId, message);
      socket.write(encodeWebSocketTextFrame(JSON.stringify(response)));
    } catch (error) {
      socket.write(encodeWebSocketTextFrame(JSON.stringify({ error: String(error) })));
    }
  }

  private sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
    res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  }
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf-8')) as Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function cryptoRandomId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function decodeWebSocketTextFrame(buffer: Buffer): string {
  const secondByte = buffer[1];
  const masked = (secondByte & 0x80) !== 0;
  let length = secondByte & 0x7f;
  let offset = 2;
  if (length === 126) {
    length = buffer.readUInt16BE(offset);
    offset += 2;
  }
  const mask = masked ? buffer.subarray(offset, offset + 4) : undefined;
  if (masked) offset += 4;
  const payload = buffer.subarray(offset, offset + length);
  if (!mask) return payload.toString('utf-8');
  const unmasked = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i++) {
    unmasked[i] = payload[i] ^ mask[i % 4];
  }
  return unmasked.toString('utf-8');
}

function encodeWebSocketTextFrame(text: string): Buffer {
  const payload = Buffer.from(text, 'utf-8');
  if (payload.length < 126) {
    return Buffer.concat([Buffer.from([0x81, payload.length]), payload]);
  }
  const header = Buffer.alloc(4);
  header[0] = 0x81;
  header[1] = 126;
  header.writeUInt16BE(payload.length, 2);
  return Buffer.concat([header, payload]);
}
