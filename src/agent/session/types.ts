import type { Message, SessionState } from '../../types/index.js';

export interface Session {
  id: string;
  userId: string;
  channel: string;
  messages: Message[];
  context: Record<string, unknown>;
  createdAt: Date;
  lastActiveAt: Date;
  status: SessionState['status'];
  metadata: SessionMetadata;
}

export interface SessionMetadata {
  agentIdentity?: Record<string, unknown>;
  userPreferences?: Record<string, unknown>;
  systemPrompt?: string;
  toolContext?: Record<string, unknown>;
}
