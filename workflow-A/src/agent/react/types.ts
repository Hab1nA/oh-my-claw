import type { Message, ToolCall } from '../../shared/types.js';
import type { ToolDefinition, ToolResult } from '../../tools/types.js';

export enum ReactState {
  THINKING = 'THINKING',
  ACTING = 'ACTING',
  OBSERVING = 'OBSERVING',
  FINISHED = 'FINISHED',
  FAILED = 'FAILED'
}

export interface ReactContext {
  sessionId: string;
  userId: string;
  messages: Message[];
  tools: ToolDefinition[];
  currentState: ReactState;
  iterationCount: number;
  maxIterations: number;
  workingDirectory: string;
}

export interface ThinkDecision {
  shouldRespond: boolean;
  response: string;
  toolCalls: ToolCall[];
}

export interface ReactTraceEvent {
  state: ReactState;
  iteration: number;
  message: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

