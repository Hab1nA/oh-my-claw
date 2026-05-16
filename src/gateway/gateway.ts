import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import { AgentRuntimeImpl } from '../agent/runtime.js';
import { SessionManager } from '../agent/session/manager.js';
import type { ToolRegistryContract } from '../tools/registry.js';
import type { Message, NormalizedMessage, OutboundMessage } from '../types/index.js';
import { randomId } from '../utils/id.js';
import type { GatewayConfig } from '../types/config.js';
import { logger } from '../utils/logger.js';
import type { ChannelRouter } from '../channels/types.js';
import type { SkillsLoader } from '../tools/skills-loader.js';
import type { ConfigParser } from '../config/parser.js';
import type { HeartbeatScheduler } from '../heartbeat/scheduler.js';

export interface GatewayDeps {
  config: GatewayConfig;
  toolRegistry: ToolRegistryContract;
  sessionManager: SessionManager;
  agentRuntime: AgentRuntimeImpl;
  channelRouter: ChannelRouter;
  skillsLoader: SkillsLoader;
  configParser: ConfigParser;
  heartbeatScheduler: HeartbeatScheduler;
}

export class Gateway {
  private readonly server: Server;
  private readonly wss: WebSocketServer;
  private readonly runtime: AgentRuntimeImpl;
  private readonly sessionManager: SessionManager;
  private readonly skillsLoader: SkillsLoader;
  private readonly configParser: ConfigParser;
  private readonly heartbeatScheduler: HeartbeatScheduler;
  private readonly channelRouter: ChannelRouter;
  private isRunning = false;

  constructor(private readonly deps: GatewayDeps) {
    this.runtime = deps.agentRuntime;
    this.sessionManager = deps.sessionManager;
    this.skillsLoader = deps.skillsLoader;
    this.configParser = deps.configParser;
    this.heartbeatScheduler = deps.heartbeatScheduler;
    this.channelRouter = deps.channelRouter;

    this.server = createServer((req, res) => void this.handleHttp(req, res));
    this.wss = new WebSocketServer({ server: this.server });
    this.wss.on('connection', (ws) => this.handleWebSocketConnection(ws));
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Gateway is already running');
      return;
    }

    logger.info('Starting OpenClaw Gateway...');

    try {
      const configs = await this.configParser.parseAll();
      logger.info('Configuration loaded', {
        soul: !!configs.soul,
        identity: !!configs.identity,
        user: !!configs.user
      });

      await this.skillsLoader.loadAll();
      logger.info('Skills loaded', { count: this.skillsLoader.getSkillCount() });

      await this.heartbeatScheduler.loadTasks(this.configParser.getConfigPath());
      logger.info('Heartbeat tasks loaded', { count: this.heartbeatScheduler.listTasks().length });

      await this.channelRouter.startAll();
      logger.info('Channel adapters started');

      this.heartbeatScheduler.start();
      logger.info('Heartbeat scheduler started');

      await new Promise<void>((resolve, reject) => {
        this.server.once('error', reject);
        this.server.listen(this.deps.config.port, this.deps.config.host, () => {
          this.server.off('error', reject);
          resolve();
        });
      });
      logger.info(`HTTP/WS server listening on ${this.deps.config.host}:${this.deps.config.port}`);

      this.isRunning = true;
      logger.info('OpenClaw Gateway started successfully');
    } catch (error) {
      logger.error('Failed to start Gateway', { error: (error as Error).message });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    logger.info('Stopping OpenClaw Gateway...');

    try {
      this.heartbeatScheduler.stop();
      await this.channelRouter.stopAll();
      this.wss.close();
      await new Promise<void>((resolve, reject) => {
        this.server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      this.isRunning = false;
      logger.info('OpenClaw Gateway stopped');
    } catch (error) {
      logger.error('Error while stopping Gateway', { error: (error as Error).message });
      throw error;
    }
  }

  async handleIncomingMessage(message: NormalizedMessage): Promise<void> {
    logger.debug('Handling incoming message', {
      channel: message.channel,
      sender: message.sender.id,
      text: message.content.text?.substring(0, 100)
    });

    const agentMessage: Message = {
      id: message.id,
      role: 'user',
      content: message.content.text || '',
      timestamp: message.timestamp,
      metadata: { ...message.metadata }
    };

    const sessionId = message.sessionId || await this.ensureSession(message);
    const response = await this.runtime.processMessage(sessionId, agentMessage);
    await this.sendResponse(message, response);
  }

  private async ensureSession(message: NormalizedMessage): Promise<string> {
    const session = await this.sessionManager.createSession(
      message.sender.id,
      message.channel
    );
    return session.id;
  }

  private async sendResponse(
    message: NormalizedMessage,
    response: { message: string; type: string }
  ): Promise<void> {
    const outbound: OutboundMessage = {
      content: {
        type: 'text',
        text: response.message
      },
      replyTo: message.id
    };

    const adapter = this.channelRouter.getAdapter(message.channel);
    if (adapter) {
      await adapter.send(message.sender.id, outbound);
    }
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
        const msg: Message = {
          id: String(body.messageId ?? randomId()),
          role: 'user',
          content,
          timestamp: new Date(),
          metadata: asRecord(body.metadata)
        };
        const response = await this.runtime.processMessage(sessionId, msg);
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
      const msg: Message = {
        id: String(body.messageId ?? randomId()),
        role: 'user',
        content: String(body.message ?? body.content ?? ''),
        timestamp: new Date(),
        metadata: asRecord(body.metadata)
      };
      const response = await this.runtime.processMessage(sessionId, msg);
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
