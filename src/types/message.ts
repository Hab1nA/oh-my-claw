export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface MessageSender {
  id: string;
  name?: string;
  username?: string;
  isBot: boolean;
}

export interface MessageRecipient {
  id: string;
  type: 'user' | 'channel' | 'group';
}

export type ContentType = 'text' | 'image' | 'audio' | 'video' | 'file' | 'location';

export interface MessageContent {
  type: ContentType;
  text?: string;
  url?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface Attachment {
  type: 'image' | 'audio' | 'video' | 'file';
  url: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  [key: string]: unknown;
}

export interface MessageMetadata {
  replyTo?: string;
  mentions?: string[];
  isEdited?: boolean;
  rawPayload?: unknown;
}

export interface NormalizedMessage {
  id: string;
  channel: string;
  sender: MessageSender;
  recipient: MessageRecipient;
  content: MessageContent;
  timestamp: Date;
  attachments?: Attachment[];
  metadata: MessageMetadata;
  sessionId?: string;
}

export interface OutboundMessage {
  content: MessageContent;
  replyTo?: string;
  replyMarkup?: ReplyMarkup;
}

export interface ReplyMarkup {
  type: 'inline' | 'reply';
  buttons: ReplyButton[][];
}

export interface ReplyButton {
  text: string;
  url?: string;
  callbackData?: string;
}
