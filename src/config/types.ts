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
  maxIterations: number;
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
