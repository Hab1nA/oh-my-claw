import type { AgentResponse, Message, SessionState } from '../shared/types.js';

export interface AgentRuntime {
  processMessage(sessionId: string, message: Message): Promise<AgentResponse>;
  getSessionState(sessionId: string): Promise<SessionState>;
  abortSession(sessionId: string): Promise<void>;
}

