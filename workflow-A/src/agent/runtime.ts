import type { GatewayConfig } from '../gateway/config/types.js';
import { Logger } from '../gateway/utils/logger.js';
import type { AgentResponse, Message, SessionState } from '../shared/types.js';
import { randomId } from '../shared/utils.js';
import type { ModelCaller } from './model/interface.js';
import { ReactEngine } from './react/engine.js';
import { ReactState, type ReactContext } from './react/types.js';
import type { AgentRuntime } from './runtime.interface.js';
import type { SessionManager } from './session/manager.js';
import type { ToolRegistry } from '../tools/registry.js';

interface AgentRuntimeOptions {
  sessionManager: SessionManager;
  toolRegistry: ToolRegistry;
  modelCaller: ModelCaller;
  config: GatewayConfig;
}

export class AgentRuntimeImpl implements AgentRuntime {
  private readonly logger = Logger.getInstance();
  private readonly engine: ReactEngine;

  constructor(private readonly options: AgentRuntimeOptions) {
    this.engine = new ReactEngine(options.modelCaller, options.toolRegistry);
  }

  async processMessage(sessionId: string, message: Message): Promise<AgentResponse> {
    const session = await this.options.sessionManager.getOrCreateSession(
      sessionId,
      String(message.metadata?.userId ?? 'anonymous'),
      String(message.metadata?.channel ?? 'direct')
    );

    await this.options.sessionManager.setStatus(sessionId, 'processing');
    await this.options.sessionManager.addMessage(sessionId, message);

    try {
      const latestSession = await this.options.sessionManager.requireSession(sessionId);
      const context: ReactContext = {
        sessionId,
        userId: latestSession.userId,
        messages: [...latestSession.messages],
        tools: this.options.toolRegistry.listTools(),
        currentState: ReactState.THINKING,
        iterationCount: 0,
        maxIterations: this.options.config.agent.maxIterations,
        workingDirectory: process.cwd()
      };

      const response = await this.engine.run(context);
      const assistantMessage: Message = {
        id: randomId(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        metadata: response.metadata
      };

      await this.options.sessionManager.replaceMessages(sessionId, [
        ...context.messages,
        assistantMessage
      ]);
      await this.options.sessionManager.setStatus(sessionId, 'idle');
      return response;
    } catch (error) {
      this.logger.error('AgentRuntime processMessage failed', { sessionId, error: String(error) });
      await this.options.sessionManager.setStatus(sessionId, 'idle');
      return {
        message: `AgentRuntime failed: ${String(error)}`,
        type: 'final',
        metadata: { error: true }
      };
    }
  }

  async getSessionState(sessionId: string): Promise<SessionState> {
    return this.options.sessionManager.getState(sessionId);
  }

  async abortSession(sessionId: string): Promise<void> {
    await this.options.sessionManager.setStatus(sessionId, 'aborted');
  }
}

