import { EventEmitter } from 'events';
import type { ChannelConfig, ContentType, NormalizedMessage, OutboundMessage, MessageSender, MessageRecipient, MessageContent, Attachment, MessageMetadata } from '../types/index.js';
import { logger, ChannelError, randomId } from '../utils/index.js';

export abstract class BaseChannelAdapter extends EventEmitter {
  protected config: ChannelConfig;
  protected isRunning: boolean = false;

  abstract readonly channelName: string;
  abstract readonly supportedContentTypes: ContentType[];

  constructor(config: ChannelConfig) {
    super();
    this.config = config;
  }

  async init(): Promise<void> {
    try {
      this.validateConfig();
      await this.setupConnection();
      this.setupEventHandlers();
      logger.info(`Channel adapter initialized: ${this.channelName}`);
    } catch (error) {
      throw new ChannelError(
        `Failed to initialize channel: ${this.channelName}`,
        this.channelName,
        error as Error
      );
    }
  }

  abstract validateConfig(): void;
  abstract setupConnection(): Promise<void>;
  abstract startListening(): Promise<void>;
  abstract stopListening(): Promise<void>;
  abstract send(destination: string, message: OutboundMessage): Promise<void>;
  abstract formatMessage(message: NormalizedMessage): Promise<unknown>;

  protected setupEventHandlers(): void {}

  protected abstract extractSender(payload: unknown): MessageSender;
  protected abstract extractRecipient(payload: unknown): MessageRecipient;
  protected abstract extractContent(payload: unknown): MessageContent;
  protected abstract extractAttachments(payload: unknown): Attachment[] | undefined;
  protected abstract extractMetadata(payload: unknown): MessageMetadata;

  protected generateMessageId(): string {
    return randomId();
  }

  protected normalizeIncoming(payload: unknown): NormalizedMessage {
    try {
      const attachments = this.extractAttachments(payload);
      const message: NormalizedMessage = {
        id: this.generateMessageId(),
        channel: this.channelName,
        sender: this.extractSender(payload),
        recipient: this.extractRecipient(payload),
        content: this.extractContent(payload),
        timestamp: new Date(),
        metadata: this.extractMetadata(payload)
      };
      if (attachments) {
        message.attachments = attachments;
      }
      return message;
    } catch (error) {
      logger.error('Failed to normalize message', {
        channel: this.channelName,
        error: (error as Error).message
      });
      throw new ChannelError(
        'Failed to normalize incoming message',
        this.channelName,
        error as Error
      );
    }
  }

  protected handleError(error: Error): void {
    logger.error('Channel error occurred', {
      channel: this.channelName,
      error: error.message
    });

    this.emit('error', {
      channel: this.channelName,
      error: error.message,
      timestamp: new Date()
    });

    if (this.shouldReconnect(error)) {
      this.scheduleReconnect();
    }
  }

  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  protected async scheduleReconnect(): Promise<void> {
    if (this.reconnectTimer) return; // already waiting for a reconnect

    const delay = this.config.reconnectDelay ?? 5000;
    logger.info(`Scheduling reconnect in ${delay}ms`, { channel: this.channelName });

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = undefined;
      try {
        await this.init();
        await this.startListening();
        logger.info('Reconnected successfully', { channel: this.channelName });
      } catch (error) {
        this.handleError(error as Error);
      }
    }, delay);
  }

  private shouldReconnect(error: Error): boolean {
    return !this.config.disableAutoReconnect && this.isRetryableError(error);
  }

  private isRetryableError(error: Error): boolean {
    const retryablePatterns = [
      'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED',
      'network', 'timeout', 'unavailable'
    ];
    return retryablePatterns.some(pattern =>
      error.message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Channel adapter is already running', { channel: this.channelName });
      return;
    }

    try {
      await this.init();
      await this.startListening();
      this.isRunning = true;
      logger.info(`Channel adapter started: ${this.channelName}`);
    } catch (error) {
      throw new ChannelError(
        `Failed to start channel: ${this.channelName}`,
        this.channelName,
        error as Error
      );
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      await this.stopListening();
      this.isRunning = false;
      logger.info(`Channel adapter stopped: ${this.channelName}`);
    } catch (error) {
      throw new ChannelError(
        `Failed to stop channel: ${this.channelName}`,
        this.channelName,
        error as Error
      );
    }
  }

  get running(): boolean {
    return this.isRunning;
  }
}
