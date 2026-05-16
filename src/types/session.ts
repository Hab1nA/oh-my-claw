import type { Message } from './message.js';
import type { ToolCall } from './tool.js';
import type { IdentityConfig, UserPreferences } from './config.js';

export interface Session {
  id: string;
  userId: string;
  channel: string;
  messages: Message[];
  context: Record<string, unknown>;
  createdAt: Date;
  lastActiveAt: Date;
  status: 'active' | 'processing' | 'idle' | 'aborted';
  metadata: SessionMetadata;
}

export interface SessionMetadata {
  agentIdentity?: IdentityConfig;
  userPreferences?: UserPreferences;
  systemPrompt?: string;
  toolContext?: Record<string, unknown>;
}

export interface SessionState {
  sessionId: string;
  status: 'active' | 'processing' | 'idle' | 'aborted';
  messageCount: number;
  lastMessage?: Date;
}

export interface AgentResponse {
  message: string;
  type: 'final' | 'partial' | 'tool_call';
  toolCalls?: ToolCall[];
  metadata?: Record<string, unknown>;
}
