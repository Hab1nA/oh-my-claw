export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  isImportant?: boolean;
}

export interface ToolCall {
  id: string;
  name: string;
  parameters: Record<string, unknown>;
}

export interface AgentResponse {
  message: string;
  type: 'final' | 'partial' | 'tool_call';
  toolCalls?: ToolCall[];
  metadata?: Record<string, unknown>;
}

export interface SessionState {
  sessionId: string;
  status: 'active' | 'processing' | 'idle' | 'aborted';
  messageCount: number;
  lastMessage?: Date;
}

