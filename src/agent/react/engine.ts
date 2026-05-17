import type { AgentResponse, IdentityConfig, Message, SoulConfig, UserPreferences } from '../../types/index.js';
import { randomId, filterEnvVars } from '../../utils/id.js';
import type { ModelCaller, ModelResponse } from '../model/interface.js';
import { PromptBuilder } from '../prompt/builder.js';
import type { ToolRegistryContract } from '../../tools/registry.js';
import type { ToolResult } from '../../types/tool.js';
import { ReactState, type ReactContext, type ThinkDecision } from './types.js';

export interface ReactEngineConfig {
  soul?: SoulConfig;
  identity?: IdentityConfig;
  user?: UserPreferences;
}

export class ReactEngine {
  private readonly promptBuilder = new PromptBuilder();
  private readonly engineConfig: ReactEngineConfig;

  constructor(
    private readonly modelCaller: ModelCaller,
    private readonly toolRegistry: ToolRegistryContract,
    engineConfig?: ReactEngineConfig
  ) {
    this.engineConfig = engineConfig ?? {};
  }

  async run(context: ReactContext): Promise<AgentResponse> {
    while (
      context.currentState !== ReactState.FINISHED &&
      context.currentState !== ReactState.FAILED &&
      context.iterationCount < context.maxIterations
    ) {
      context.currentState = ReactState.THINKING;
      const decision = await this.think(context);

      if (decision.shouldRespond) {
        context.currentState = ReactState.FINISHED;
        return {
          message: decision.response,
          type: 'final',
          metadata: { state: context.currentState, iterations: context.iterationCount }
        };
      }

      context.currentState = ReactState.ACTING;
      const results = await this.act(context, decision.toolCalls);

      context.currentState = ReactState.OBSERVING;
      context.messages.push(...this.formatToolResults(results));
      context.iterationCount++;
    }

    return {
      message: 'Reached maximum ReAct iterations before producing a final response.',
      type: 'final',
      metadata: { state: ReactState.FAILED, iterations: context.iterationCount }
    };
  }

  private buildSystemPrompt(tools: import('../../types/tool.js').ToolDefinition[]): string {
    if (this.engineConfig.soul && this.engineConfig.identity && this.engineConfig.user) {
      return this.promptBuilder.buildSystemPromptFromConfig(
        this.engineConfig.soul,
        this.engineConfig.identity,
        this.engineConfig.user,
        tools
      );
    }
    return this.promptBuilder.buildSystemPrompt(tools);
  }

  private async think(context: ReactContext): Promise<ThinkDecision> {
    const response = await this.modelCaller.call({
      system: this.buildSystemPrompt(context.tools),
      messages: this.promptBuilder.buildMessages(context.messages),
      tools: context.tools
    });

    context.messages.push({
      id: randomId(),
      role: 'assistant',
      content: response.content,
      timestamp: new Date(),
      metadata: {
        finishReason: response.finishReason,
        toolCalls: response.toolCalls
      }
    });

    return this.parseThinkResponse(response);
  }

  private parseThinkResponse(response: ModelResponse): ThinkDecision {
    if (response.finishReason === 'tool_calls' && response.toolCalls?.length) {
      return {
        shouldRespond: false,
        response: response.content,
        toolCalls: response.toolCalls
      };
    }
    return {
      shouldRespond: true,
      response: response.content,
      toolCalls: []
    };
  }

  private async act(context: ReactContext, toolCalls: Array<{ id: string; name: string; parameters: Record<string, unknown> }>): Promise<ToolResult[]> {
    const results = await Promise.all(
      toolCalls.map(async (toolCall) => {
        const result = await this.toolRegistry.executeTool(toolCall.name, toolCall.parameters, {
          sessionId: context.sessionId,
          userId: context.userId,
          workingDirectory: context.workingDirectory,
          environment: filterEnvVars(process.env),
          toolCallId: toolCall.id
        });
        return { ...result, metadata: { ...result.metadata, toolCallId: toolCall.id, toolName: toolCall.name } };
      })
    );
    return results;
  }

  private formatToolResults(results: ToolResult[]): Message[] {
    return results.map((result) => ({
      id: randomId(),
      role: 'tool',
      content: JSON.stringify(result),
      timestamp: new Date(),
      metadata: {
        toolCallId: result.metadata?.toolCallId,
        toolName: result.metadata?.toolName
      },
      isImportant: true
    }));
  }
}
