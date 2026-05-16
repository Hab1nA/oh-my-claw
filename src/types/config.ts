export interface SoulConfig {
  values: string;
  behavior: string[];
  guidelines: string[];
}

export interface IdentityConfig {
  name: string;
  age?: string;
  background: string;
  personality: string[];
  traits: string[];
  greeting?: string;
}

export interface NotificationPreferences {
  enabled: boolean;
  quietHours?: string;
}

export interface UserPreferences {
  name: string;
  language: string;
  timezone: string;
  channels: string[];
  notificationPreferences: NotificationPreferences;
}

export interface GatewayConfig {
  port: number;
  host: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  agent: AgentConfig;
  tools: ToolsConfig;
  memory: MemoryConfig;
}

export interface AgentConfig {
  model: string;
  apiKey: string;
  baseUrl?: string;
  maxTokens: number;
  temperature: number;
}

export interface ToolsConfig {
  timeout: number;
  allowedPaths: string[];
  blockedCommands: string[];
}

export interface MemoryConfig {
  storagePath: string;
  maxHistoryLength: number;
}

export interface ChannelConfig {
  name: string;
  enabled: boolean;
  reconnectDelay?: number;
  disableAutoReconnect?: boolean;
  useWebhook?: boolean;
  webhookUrl?: string;
}
