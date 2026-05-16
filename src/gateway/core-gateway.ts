import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import { AgentRuntimeImpl } from '../agent/runtime.js';
import { OpenAICompatibleModelCaller } from '../agent/model/caller.js';
import { SessionManager } from '../agent/session/manager.js';
import { ToolRegistry } from '../tools/core-registry.js';
import { registerBuiltInTools } from '../tools/builtins/index.js';
import type { Message } from '../types/index.js';
import { randomId } from '../utils/id.js';
import type { GatewayConfig } from '../config/types.js';
import { logger } from '../utils/logger.js';

export class Gateway {
  private readonly server: Server;
  private readonly wss: WebSocketServer;
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
    this.wss = new WebSocketServer({ server: this.server });
    this.wss.on('connection', (ws) => this.handleWebSocketConnection(ws));
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
    this.wss.close();
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
        const sessionId = url.pathname.split('/')[2] ?? 'default';
        this.sendJson(res, 200, await this.runtime.getSessionState(sessionId));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/v1/messages') {
        const body = await readJsonBody(req);
        const sessionId = String(body.sessionId ?? 'default');
        const content = String(body.message ?? body.content ?? '');
        const message: Message = {
          id: String(body.messageId ?? randomId()),
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
      logger.error('HTTP request failed', { error: String(error) });
      this.sendJson(res, 500, { error: String(error) });
    }
  }

  private handleWebSocketConnection(ws: WebSocket): void {
    ws.on('message', (raw) => {
      void this.handleWebSocketMessage(ws, raw);
    });
  }

  private async handleWebSocketMessage(ws: WebSocket, raw: unknown): Promise<void> {
    try {
      const text = typeof raw === 'string' ? raw : String(raw);
      const body = JSON.parse(text) as Record<string, unknown>;
      const sessionId = String(body.sessionId ?? 'default');
      const message: Message = {
        id: String(body.messageId ?? randomId()),
        role: 'user',
        content: String(body.message ?? body.content ?? ''),
        timestamp: new Date(),
        metadata: asRecord(body.metadata)
      };
      const response = await this.runtime.processMessage(sessionId, message);
      ws.send(JSON.stringify(response));
    } catch (error) {
      ws.send(JSON.stringify({ error: String(error) }));
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
