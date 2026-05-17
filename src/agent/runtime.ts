import type { GatewayConfig, IdentityConfig, SoulConfig, UserPreferences } from '../types/config.js';
import { logger } from '../utils/logger.js';
import type { AgentResponse, Message, SessionState } from '../types/index.js';
import { randomId } from '../utils/id.js';
import type { ModelCaller } from './model/interface.js';
import { ReactEngine, type ReactEngineConfig } from './react/engine.js';
import { ReactState, type ReactContext } from './react/types.js';
import type { AgentRuntime } from './runtime.interface.js';
import type { SessionManager } from './session/manager.js';
import type { ToolRegistryContract } from '../tools/registry.js';

interface AgentRuntimeOptions {
  sessionManager: SessionManager;
  toolRegistry: ToolRegistryContract;
  modelCaller: ModelCaller;
  config: GatewayConfig;
  engineConfig?: ReactEngineConfig;
}

export class AgentRuntimeImpl implements AgentRuntime {
  private readonly engine: ReactEngine;

  constructor(private readonly options: AgentRuntimeOptions) {
    this.engine = new ReactEngine(options.modelCaller, options.toolRegistry, options.engineConfig);
  }

  setEngineConfig(soul: SoulConfig, identity: IdentityConfig, user: UserPreferences): void {
    const engine = new ReactEngine(
      this.options.modelCaller,
      this.options.toolRegistry,
      { soul, identity, user }
    );
    (this as unknown as { engine: ReactEngine }).engine = engine;
  }

  async processMessage(sessionId: string, message: Message): Promise<AgentResponse> {
    await this.options.sessionManager.getOrCreateSession(
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
      logger.error('AgentRuntime processMessage failed', { sessionId, error: String(error) });
      try {
        const currentSession = await this.options.sessionManager.requireSession(sessionId);
        await this.options.sessionManager.replaceMessages(sessionId, currentSession.messages);
      } catch {
        // session may be in an inconsistent state; best-effort persist
      }
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
