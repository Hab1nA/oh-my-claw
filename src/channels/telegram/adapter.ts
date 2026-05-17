import axios, { AxiosInstance } from 'axios';
import type { ChannelConfig, ContentType, NormalizedMessage, OutboundMessage, MessageSender, MessageRecipient, MessageContent, Attachment, MessageMetadata, ReplyMarkup } from '../../types/index.js';
import { BaseChannelAdapter } from '../adapter.js';
import { logger, ChannelError } from '../../utils/index.js';

export interface TelegramConfig extends ChannelConfig {
  botToken: string;
  webhookSecret?: string;
  pollingInterval?: number;
}

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  caption?: string;
  photo?: TelegramPhoto[];
  document?: TelegramDocument;
  audio?: TelegramAudio;
  video?: TelegramVideo;
  location?: TelegramLocation;
  reply_to_message?: TelegramMessage;
  edit_date?: number;
}

interface TelegramPhoto {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  width: number;
  height: number;
}

interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

interface TelegramAudio {
  file_id: string;
  file_unique_id: string;
  duration: number;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

interface TelegramVideo {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

interface TelegramLocation {
  latitude: number;
  longitude: number;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  callback_query?: {
    id: string;
    from: TelegramUser;
    message?: TelegramMessage;
    data?: string;
  };
}

interface TelegramApiResponse<T = unknown> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

export class TelegramAdapter extends BaseChannelAdapter {
  readonly channelName = 'telegram';
  readonly supportedContentTypes: ContentType[] = [
    'text', 'image', 'audio', 'video', 'file', 'location'
  ];

  private telegramConfig: TelegramConfig;
  private apiClient: AxiosInstance;
  private apiBase: string;
  private updateOffset: number = 0;
  private pollingTimer: ReturnType<typeof setInterval> | undefined;

  constructor(config: TelegramConfig) {
    super(config);
    this.telegramConfig = config;
    this.apiBase = `https://api.telegram.org/bot${config.botToken}`;
    this.apiClient = axios.create({
      baseURL: this.apiBase,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  validateConfig(): void {
    if (!this.telegramConfig.botToken) {
      throw new ChannelError('Telegram bot token is required', this.channelName);
    }
    
    if (this.telegramConfig.useWebhook && !this.telegramConfig.webhookSecret) {
      logger.warn('Webhook secret is recommended for security', { channel: this.channelName });
    }
  }

  async setupConnection(): Promise<void> {
    try {
      const response = await this.apiCall<TelegramUser>('getMe');
      
      if (!response.ok || !response.result) {
        throw new ChannelError(
          `Failed to connect to Telegram: ${response.description ?? 'Unknown error'}`,
          this.channelName
        );
      }

      logger.info('Connected to Telegram', {
        botId: response.result.id,
        botName: response.result.first_name,
        botUsername: response.result.username
      });
    } catch (error) {
      throw new ChannelError(
        'Failed to setup Telegram connection',
        this.channelName,
        error as Error
      );
    }
  }

  protected override setupEventHandlers(): void {
    this.on('callback', async (callback: { id: string; from: TelegramUser; data?: string; message?: TelegramMessage }) => {
      try {
        await this.apiCall('answerCallbackQuery', {
          callback_query_id: callback.id
        });
      } catch (error) {
        logger.error('Failed to answer callback query', { error: (error as Error).message });
      }
    });
  }

  async startListening(): Promise<void> {
    if (this.telegramConfig.useWebhook) {
      await this.setupWebhook();
    } else {
      this.startPolling();
    }
  }

  async stopListening(): Promise<void> {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = undefined;
    }

    if (this.telegramConfig.useWebhook) {
      try {
        await this.apiCall('deleteWebhook');
        logger.info('Webhook deleted', { channel: this.channelName });
      } catch (error) {
        logger.error('Failed to delete webhook', { error: (error as Error).message });
      }
    }
  }

  private async setupWebhook(): Promise<void> {
    if (!this.telegramConfig.webhookUrl) {
      throw new ChannelError('Webhook URL is required for webhook mode', this.channelName);
    }

    const webhookUrl = `${this.telegramConfig.webhookUrl}/channels/telegram/webhook`;
    
    try {
      const response = await this.apiCall('setWebhook', {
        url: webhookUrl,
        secret_token: this.telegramConfig.webhookSecret,
        allowed_updates: ['message', 'edited_message', 'callback_query']
      });

      if (!response.ok) {
        throw new ChannelError(
          `Failed to set webhook: ${response.description ?? 'Unknown error'}`,
          this.channelName
        );
      }

      logger.info('Webhook configured', { webhookUrl });
    } catch (error) {
      throw new ChannelError(
        'Failed to setup webhook',
        this.channelName,
        error as Error
      );
    }
  }

  private startPolling(): void {
    const interval = this.telegramConfig.pollingInterval ?? 1000;
    
    logger.info('Starting polling mode', { interval, channel: this.channelName });
    
    this.pollingTimer = setInterval(async () => {
      try {
        await this.fetchUpdates();
      } catch (error) {
        this.handleError(error as Error);
      }
    }, interval);
  }

  private async fetchUpdates(): Promise<void> {
    const response = await this.apiCall<TelegramUpdate[]>('getUpdates', {
      offset: this.updateOffset,
      timeout: 30,
      allowed_updates: ['message', 'edited_message', 'callback_query']
    });

    if (response.ok && response.result && response.result.length > 0) {
      for (const update of response.result) {
        await this.processUpdate(update);
        this.updateOffset = update.update_id + 1;
      }
    }
  }

  async handleWebhookUpdate(update: TelegramUpdate): Promise<void> {
    await this.processUpdate(update);
  }

  private async processUpdate(update: TelegramUpdate): Promise<void> {
    const message = update.message ?? update.edited_message;
    
    if (message) {
      try {
        const normalized = this.normalizeIncoming(message);
        if (update.edited_message) {
          normalized.metadata.isEdited = true;
        }
        this.emit('message', normalized);
      } catch (error) {
        logger.error('Failed to process message', {
          updateId: update.update_id,
          error: (error as Error).message
        });
      }
    }

    if (update.callback_query) {
      this.emit('callback', {
        id: update.callback_query.id,
        from: update.callback_query.from,
        data: update.callback_query.data,
        message: update.callback_query.message
      });
    }
  }

  protected extractSender(payload: unknown): MessageSender {
    const msg = payload as TelegramMessage;
    const from = msg.from ?? msg.chat;
    
    const sender: MessageSender = {
      id: String(from.id),
      name: `${from.first_name}${'last_name' in from && from.last_name ? ` ${from.last_name}` : ''}`,
      isBot: 'is_bot' in from ? from.is_bot : false
    };
    
    if ('username' in from && from.username) {
      sender.username = from.username;
    }
    
    return sender;
  }

  protected extractRecipient(payload: unknown): MessageRecipient {
    const msg = payload as TelegramMessage;
    
    let type: 'user' | 'channel' | 'group' = 'user';
    if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
      type = 'group';
    } else if (msg.chat.type === 'channel') {
      type = 'channel';
    }

    return {
      id: String(msg.chat.id),
      type
    };
  }

  protected extractContent(payload: unknown): MessageContent {
    const msg = payload as TelegramMessage;

    if (msg.text) {
      return { type: 'text', text: msg.text };
    }

    if (msg.photo && msg.photo.length > 0) {
      const largestPhoto = msg.photo[msg.photo.length - 1];
      if (largestPhoto) {
        const content: MessageContent = {
          type: 'image',
          url: largestPhoto.file_id
        };
        if (msg.caption) {
          content.text = msg.caption;
        }
        return content;
      }
    }

    if (msg.document) {
      const content: MessageContent = {
        type: 'file',
        url: msg.document.file_id,
        data: {
          filename: msg.document.file_name,
          mimeType: msg.document.mime_type,
          size: msg.document.file_size
        }
      };
      if (msg.caption) {
        content.text = msg.caption;
      }
      return content;
    }

    if (msg.audio) {
      const content: MessageContent = {
        type: 'audio',
        url: msg.audio.file_id,
        data: {
          duration: msg.audio.duration,
          mimeType: msg.audio.mime_type,
          size: msg.audio.file_size
        }
      };
      if (msg.audio.file_name) {
        content.text = msg.audio.file_name;
      }
      return content;
    }

    if (msg.video) {
      const content: MessageContent = {
        type: 'video',
        url: msg.video.file_id,
        data: {
          duration: msg.video.duration,
          width: msg.video.width,
          height: msg.video.height,
          mimeType: msg.video.mime_type,
          size: msg.video.file_size
        }
      };
      if (msg.video.file_name) {
        content.text = msg.video.file_name;
      }
      return content;
    }

    if (msg.location) {
      return {
        type: 'location',
        data: {
          latitude: msg.location.latitude,
          longitude: msg.location.longitude
        }
      };
    }

    return { type: 'text', text: '' };
  }

  protected extractAttachments(payload: unknown): Attachment[] | undefined {
    const msg = payload as TelegramMessage;
    const attachments: Attachment[] = [];

    if (msg.photo && msg.photo.length > 0) {
      const largestPhoto = msg.photo[msg.photo.length - 1];
      if (largestPhoto) {
        const attachment: Attachment = {
          type: 'image',
          url: largestPhoto.file_id
        };
        if (largestPhoto.file_size) {
          attachment.size = largestPhoto.file_size;
        }
        attachments.push(attachment);
      }
    }

    if (msg.document) {
      const attachment: Attachment = {
        type: 'file',
        url: msg.document.file_id
      };
      if (msg.document.file_name) {
        attachment.filename = msg.document.file_name;
      }
      if (msg.document.mime_type) {
        attachment.mimeType = msg.document.mime_type;
      }
      if (msg.document.file_size) {
        attachment.size = msg.document.file_size;
      }
      attachments.push(attachment);
    }

    if (msg.audio) {
      const attachment: Attachment = {
        type: 'audio',
        url: msg.audio.file_id
      };
      if (msg.audio.file_name) {
        attachment.filename = msg.audio.file_name;
      }
      if (msg.audio.mime_type) {
        attachment.mimeType = msg.audio.mime_type;
      }
      if (msg.audio.file_size) {
        attachment.size = msg.audio.file_size;
      }
      attachments.push(attachment);
    }

    if (msg.video) {
      const attachment: Attachment = {
        type: 'video',
        url: msg.video.file_id
      };
      if (msg.video.file_name) {
        attachment.filename = msg.video.file_name;
      }
      if (msg.video.mime_type) {
        attachment.mimeType = msg.video.mime_type;
      }
      if (msg.video.file_size) {
        attachment.size = msg.video.file_size;
      }
      attachments.push(attachment);
    }

    return attachments.length > 0 ? attachments : undefined;
  }

  protected extractMetadata(payload: unknown): MessageMetadata {
    const msg = payload as TelegramMessage;
    const metadata: MessageMetadata = {
      isEdited: msg.edit_date !== undefined
    };

    if (msg.reply_to_message) {
      metadata.replyTo = String(msg.reply_to_message.message_id);
    }

    return metadata;
  }

  async send(destination: string, message: OutboundMessage): Promise<void> {
    try {
      const params: Record<string, unknown> = {
        chat_id: destination,
        parse_mode: 'MarkdownV2'
      };

      if (message.content.type === 'text') {
        params['text'] = this.escapeMarkdown(message.content.text ?? '');
        
        if (message.replyMarkup) {
          params['reply_markup'] = this.formatReplyMarkup(message.replyMarkup);
        }

        await this.apiCall('sendMessage', params);
      } else if (message.content.type === 'image') {
        params['photo'] = message.content.url;
        if (message.content.text) {
          params['caption'] = this.escapeMarkdown(message.content.text);
        }
        
        await this.apiCall('sendPhoto', params);
      } else if (message.content.type === 'file') {
        params['document'] = message.content.url;
        if (message.content.text) {
          params['caption'] = this.escapeMarkdown(message.content.text);
        }
        
        await this.apiCall('sendDocument', params);
      } else if (message.content.type === 'audio') {
        params['audio'] = message.content.url;
        if (message.content.text) {
          params['caption'] = this.escapeMarkdown(message.content.text);
        }
        
        await this.apiCall('sendAudio', params);
      } else if (message.content.type === 'video') {
        params['video'] = message.content.url;
        if (message.content.text) {
          params['caption'] = this.escapeMarkdown(message.content.text);
        }
        
        await this.apiCall('sendVideo', params);
      } else if (message.content.type === 'location') {
        const data = message.content.data as { latitude: number; longitude: number };
        params['latitude'] = data.latitude;
        params['longitude'] = data.longitude;
        
        await this.apiCall('sendLocation', params);
      } else {
        throw new ChannelError(`Unsupported content type: ${message.content.type}`, this.channelName);
      }

      logger.debug('Message sent', { destination, type: message.content.type });
    } catch (error) {
      logger.error('Failed to send message', {
        destination,
        error: (error as Error).message
      });
      throw new ChannelError('Failed to send message', this.channelName, error as Error);
    }
  }

  async formatMessage(message: NormalizedMessage): Promise<unknown> {
    return {
      chat_id: message.recipient.id,
      text: message.content.text,
      parse_mode: 'MarkdownV2'
    };
  }

  private formatReplyMarkup(markup: ReplyMarkup): Record<string, unknown> {
    if (markup.type === 'inline') {
      return {
        inline_keyboard: markup.buttons.map(row =>
          row.map(btn => ({
            text: btn.text,
            ...(btn.url ? { url: btn.url } : {}),
            ...(btn.callbackData ? { callback_data: btn.callbackData } : {})
          }))
        )
      };
    }

    return {
      keyboard: markup.buttons.map(row =>
        row.map(btn => ({ text: btn.text }))
      ),
      resize_keyboard: true,
      one_time_keyboard: true
    };
  }

  private escapeMarkdown(text: string): string {
    const escapeChars = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];
    return text.split('').map(char => 
      escapeChars.includes(char) ? `\\${char}` : char
    ).join('');
  }

  private async apiCall<T = unknown>(
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<TelegramApiResponse<T>> {
    try {
      const response = await this.apiClient.post<TelegramApiResponse<T>>(
        `/${method}`,
        params
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new ChannelError(
          `Telegram API error: ${error.message}`,
          this.channelName,
          error
        );
      }
      throw error;
    }
  }
}
