import type {
  Message,
  Session,
  AgentResponse,
  SessionState,
  SessionFilter
} from '../types/index';

/**
 * Agent Runtime Interface
 * 任务流甲需要实现的核心接口
 */
export interface AgentRuntime {
  /**
   * 处理用户消息
   */
  processMessage(sessionId: string, message: Message): Promise<AgentResponse>;

  /**
   * 获取会话状态
   */
  getSessionState(sessionId: string): Promise<SessionState>;

  /**
   * 中断会话
   */
  abortSession(sessionId: string): Promise<void>;
}

/**
 * Session Manager Interface
 * 两个任务流共享的会话管理接口
 */
export interface SessionManager {
  createSession(userId: string, channel: string): Promise<Session>;
  getSession(sessionId: string): Promise<Session | undefined>;
  addMessage(sessionId: string, message: Message): Promise<void>;
  updateContext(sessionId: string, context: Record<string, unknown>): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  listSessions(filter?: SessionFilter): Promise<Session[]>;
}

/**
 * Prompt Builder Interface
 * 用于构建LLM提示词的接口
 */
export interface PromptBuilder {
  buildSystemPrompt(config: {
    soul?: Record<string, unknown>;
    identity?: Record<string, unknown>;
    user?: Record<string, unknown>;
  }): Promise<string>;
}

/**
 * Model Caller Interface
 * LLM调用的抽象接口
 */
export interface ModelCaller {
  call(prompt: ModelPrompt): Promise<ModelResponse>;
  callStream(prompt: ModelPrompt, onChunk: (chunk: string) => void): Promise<void>;
}

export interface ModelPrompt {
  system: string;
  messages: Message[];
  tools?: unknown[];
  temperature?: number;
  maxTokens?: number;
}

export interface ModelResponse {
  content: string;
  toolCalls?: unknown[];
  finishReason: 'stop' | 'length' | 'tool_calls' | 'error';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
