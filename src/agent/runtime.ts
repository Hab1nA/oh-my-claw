import type { GatewayConfig, IdentityConfig, SoulConfig, UserPreferences } from '../types/config.js';
import { logger } from '../utils/logger.js';
import type { AgentResponse, Message, SessionState } from '../types/index.js';
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
  private engine: ReactEngine;

  constructor(private readonly options: AgentRuntimeOptions) {
    this.engine = new ReactEngine(options.modelCaller, options.toolRegistry, options.engineConfig);
  }

  setEngineConfig(soul: SoulConfig, identity: IdentityConfig, user: UserPreferences): void {
    this.engine = new ReactEngine(
      this.options.modelCaller,
      this.options.toolRegistry,
      { soul, identity, user }
    );
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

      // Merge engine-level metadata (state, iterations) into the last assistant
      // message that think() already pushed — avoids duplicating the response.
      const lastMsg = context.messages[context.messages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant') {
        lastMsg.metadata = { ...lastMsg.metadata, ...response.metadata };
      }

      await this.options.sessionManager.replaceMessages(sessionId, context.messages);
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
