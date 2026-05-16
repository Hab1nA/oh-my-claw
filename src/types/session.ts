import type { ToolCall } from './tool.js';
import type { IdentityConfig, UserPreferences } from './config.js';

export interface Session {
  id: string;
  userId: string;
  channel: string;
  messages: SessionMessage[];
  context: Record<string, unknown>;
  createdAt: Date;
  lastActiveAt: Date;
  status: 'active' | 'processing' | 'idle' | 'aborted';
  metadata: SessionMetadata;
}

export interface SessionMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  isImportant?: boolean;
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

export interface SessionManager {
  createSession(userId: string, channel: string): Promise<Session>;
  getSession(sessionId: string): Promise<Session | undefined>;
  addMessage(sessionId: string, message: SessionMessage): Promise<void>;
  updateContext(sessionId: string, context: Record<string, unknown>): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  listSessions(filter?: SessionFilter): Promise<Session[]>;
}

export interface SessionFilter {
  userId?: string;
  channel?: string;
  status?: 'active' | 'processing' | 'idle' | 'aborted';
}
