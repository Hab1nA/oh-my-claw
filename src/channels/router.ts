import { v4 as uuidv4 } from 'uuid';
import type { NormalizedMessage, Session } from '../types/index.js';
import type { BaseChannelAdapter } from './adapter.js';
import type { MessageHandler, ChannelRouter } from './types.js';
import { logger } from '../utils/index.js';

export class ChannelRouterImpl implements ChannelRouter {
  private adapters: Map<string, BaseChannelAdapter> = new Map();
  private messageHandler: MessageHandler;
  private sessions: Map<string, Session> = new Map();

  constructor(messageHandler: MessageHandler) {
    this.messageHandler = messageHandler;
  }

  registerAdapter(adapter: BaseChannelAdapter): void {
    adapter.on('message', async (message: NormalizedMessage) => {
      await this.routeMessage(message);
    });

    adapter.on('error', (errorInfo: { channel: string; error: string; timestamp: Date }) => {
      logger.error('Adapter error', errorInfo);
      if (this.messageHandler.onError) {
        this.messageHandler.onError(new Error(errorInfo.error));
      }
    });

    this.adapters.set(adapter.channelName, adapter);
    logger.info(`Registered channel adapter: ${adapter.channelName}`);
  }

  unregisterAdapter(channelName: string): void {
    const adapter = this.adapters.get(channelName);
    if (adapter) {
      adapter.removeAllListeners();
      this.adapters.delete(channelName);
      logger.info(`Unregistered channel adapter: ${channelName}`);
    }
  }

  getAdapter(channelName: string): BaseChannelAdapter | undefined {
    return this.adapters.get(channelName);
  }

  async routeMessage(message: NormalizedMessage): Promise<void> {
    try {
      const sessionId = this.resolveSession(message);
      
      const messageWithSession: NormalizedMessage = {
        ...message,
        sessionId
      };

      logger.debug('Routing message', {
        messageId: message.id,
        channel: message.channel,
        sessionId,
        senderId: message.sender.id
      });

      await this.messageHandler.onMessage(messageWithSession);
    } catch (error) {
      logger.error('Failed to route message', {
        messageId: message.id,
        channel: message.channel,
        error: (error as Error).message
      });
      throw error;
    }
  }

  async startAll(): Promise<void> {
    const startPromises: Promise<void>[] = [];
    
    for (const [name, adapter] of this.adapters) {
      startPromises.push(
        adapter.start().catch((error) => {
          logger.error(`Failed to start adapter: ${name}`, { error: error.message });
        })
      );
    }

    await Promise.all(startPromises);
    logger.info('All channel adapters started');
  }

  async stopAll(): Promise<void> {
    const stopPromises: Promise<void>[] = [];
    
    for (const [name, adapter] of this.adapters) {
      stopPromises.push(
        adapter.stop().catch((error) => {
          logger.error(`Failed to stop adapter: ${name}`, { error: error.message });
        })
      );
    }

    await Promise.all(stopPromises);
    logger.info('All channel adapters stopped');
  }

  private resolveSession(message: NormalizedMessage): string {
    const existingSession = this.findExistingSession(message);
    if (existingSession) {
      return existingSession;
    }

    return this.createNewSession(message);
  }

  private findExistingSession(message: NormalizedMessage): string | undefined {
    for (const [sessionId, session] of this.sessions) {
      if (session.userId === message.sender.id && session.channel === message.channel) {
        session.lastActiveAt = new Date();
        return sessionId;
      }
    }
    return undefined;
  }

  private createNewSession(message: NormalizedMessage): string {
    const sessionId = uuidv4();
    
    const session: Session = {
      id: sessionId,
      userId: message.sender.id,
      channel: message.channel,
      messages: [],
      context: {},
      createdAt: new Date(),
      lastActiveAt: new Date(),
      metadata: {}
    };

    this.sessions.set(sessionId, session);
    logger.debug('Created new session', { sessionId, userId: message.sender.id, channel: message.channel });
    
    return sessionId;
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  listActiveSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  cleanInactiveSessions(maxInactiveMs: number): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions) {
      const inactiveTime = now - session.lastActiveAt.getTime();
      if (inactiveTime > maxInactiveMs) {
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`Cleaned ${cleaned} inactive sessions`);
    }

    return cleaned;
  }
}
