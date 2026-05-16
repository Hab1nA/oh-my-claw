import type { AgentConfig } from '../../config/types.js';
import type { ToolCall } from '../../types/index.js';
import type { ToolDefinition } from '../../types/tool.js';
import type { ModelCaller, ModelPrompt, ModelResponse } from './interface.js';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

interface OpenAIToolCall {
  id?: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

interface OpenAIResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
  };
}

export class OpenAICompatibleModelCaller implements ModelCaller {
  constructor(private readonly config: AgentConfig) {}

  async call(prompt: ModelPrompt): Promise<ModelResponse> {
    if (!this.config.apiKey) {
      return {
        content: 'LLM API key is not configured. Please set OPENCLAW_API_KEY.',
        finishReason: 'error'
      };
    }

    const response = await fetch(`${this.baseUrl()}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.config.apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config.model,
        temperature: prompt.temperature ?? this.config.temperature,
        max_tokens: prompt.maxTokens ?? this.config.maxTokens,
        messages: this.toOpenAIMessages(prompt),
        tools: prompt.tools?.map(toOpenAITool),
        tool_choice: prompt.tools?.length ? 'auto' : undefined
      })
    });

    const data = (await response.json()) as OpenAIResponse;
    if (!response.ok) {
      return {
        content: data.error?.message ?? `Model API failed with HTTP ${response.status}`,
        finishReason: 'error'
      };
    }

    const choice = data.choices?.[0];
    const message = choice?.message;
    const toolCalls = parseToolCalls(message?.tool_calls ?? []);
    return {
      content: message?.content ?? '',
      toolCalls,
      finishReason: toolCalls.length > 0 ? 'tool_calls' : normalizeFinishReason(choice?.finish_reason),
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens ?? 0,
            completionTokens: data.usage.completion_tokens ?? 0,
            totalTokens: data.usage.total_tokens ?? 0
          }
        : undefined
    };
  }

  // TODO: stub implementation — does not actually stream; falls back to non-streaming call
  async callStream(prompt: ModelPrompt, onChunk: (chunk: string) => void): Promise<void> {
    const response = await this.call(prompt);
    onChunk(response.content);
  }

  private baseUrl(): string {
    return (this.config.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  }

  private toOpenAIMessages(prompt: ModelPrompt): OpenAIMessage[] {
    const messages: OpenAIMessage[] = [{ role: 'system', content: prompt.system }];
    for (const message of prompt.messages) {
      if (message.role === 'tool') {
        messages.push({
          role: 'tool',
          content: message.content,
          tool_call_id: String(message.metadata?.toolCallId ?? message.id)
        });
      } else {
        const openAiMessage: OpenAIMessage = { role: message.role, content: message.content };
        const toolCalls = asToolCalls(message.metadata?.toolCalls);
        if (message.role === 'assistant' && toolCalls.length > 0) {
          openAiMessage.tool_calls = toolCalls.map((toolCall) => ({
            id: toolCall.id,
            type: 'function',
            function: {
              name: toolCall.name,
              arguments: JSON.stringify(toolCall.parameters)
            }
          }));
        }
        messages.push(openAiMessage);
      }
    }
    return messages;
  }
}

function toOpenAITool(tool: ToolDefinition): Record<string, unknown> {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  };
}

function parseToolCalls(toolCalls: OpenAIToolCall[]): ToolCall[] {
  return toolCalls
    .map((toolCall, index) => {
      const name = toolCall.function?.name;
      if (!name) return undefined;
      return {
        id: toolCall.id ?? `tool_call_${index}`,
        name,
        parameters: parseToolArguments(toolCall.function?.arguments)
      };
    })
    .filter((item): item is ToolCall => Boolean(item));
}

function parseToolArguments(value: string | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return { raw: value };
  }
}

function normalizeFinishReason(value: string | undefined): ModelResponse['finishReason'] {
  if (value === 'length') return 'length';
  if (value === 'tool_calls') return 'tool_calls';
  if (value === 'stop' || !value) return 'stop';
  return 'error';
}

function asToolCalls(value: unknown): ToolCall[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ToolCall => {
    if (!item || typeof item !== 'object') return false;
    const candidate = item as Partial<ToolCall>;
    return (
      typeof candidate.id === 'string' &&
      typeof candidate.name === 'string' &&
      Boolean(candidate.parameters) &&
      typeof candidate.parameters === 'object'
    );
  });
}
