import type { Message, ToolCall } from '../../types/index.js';
import type { ToolDefinition } from '../../types/tool.js';

export interface ModelCaller {
  call(prompt: ModelPrompt): Promise<ModelResponse>;
  callStream(prompt: ModelPrompt, onChunk: (chunk: string) => void): Promise<void>;
}

export interface ModelPrompt {
  system: string;
  messages: Message[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
}

export interface ModelResponse {
  content: string;
  toolCalls?: ToolCall[];
  finishReason: 'stop' | 'length' | 'tool_calls' | 'error';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
