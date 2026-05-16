import type { NormalizedMessage } from '../types/index.js';
import type { BaseChannelAdapter } from './adapter.js';

export interface MessageHandler {
  onMessage(message: NormalizedMessage): Promise<void>;
  onError?(error: Error): void;
}

export interface ChannelRouter {
  registerAdapter(adapter: BaseChannelAdapter): void;
  unregisterAdapter(channelName: string): void;
  getAdapter(channelName: string): BaseChannelAdapter | undefined;
  routeMessage(message: NormalizedMessage): Promise<void>;
  startAll(): Promise<void>;
  stopAll(): Promise<void>;
}
