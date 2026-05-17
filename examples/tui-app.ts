#!/usr/bin/env ts-node
/**
 * OpenClaw TUI — Terminal-only chat interface.
 *
 * Usage:
 *   npx tsx examples/tui-app.ts
 *   # or: npm run dev:tui
 *
 * Environment variables:
 *   OPENCLAW_API_KEY   — LLM API key (required for real conversations)
 *   OPENCLAW_MODEL     — Model name (default: deepseek-chat)
 *   OPENCLAW_BASE_URL  — API base URL (default: https://api.deepseek.com)
 */
import { loadConfig } from '../src/config/loader.js';
import { ConfigParser } from '../src/config/parser.js';
import { ToolRegistry } from '../src/tools/registry.js';
import { registerBuiltInTools } from '../src/tools/builtins/index.js';
import { SkillsLoader } from '../src/tools/skills-loader.js';
import { ChannelRouterImpl } from '../src/channels/router.js';
import { TuiAdapter } from '../src/channels/tui/adapter.js';
import { HeartbeatScheduler } from '../src/heartbeat/scheduler.js';
import { AgentRuntimeImpl } from '../src/agent/runtime.js';
import { OpenAICompatibleModelCaller } from '../src/agent/model/caller.js';
import { SessionManager } from '../src/agent/session/manager.js';
import { logger } from '../src/utils/logger.js';
import type { NormalizedMessage, Message } from '../src/types/index.js';
import { randomId } from '../src/utils/id.js';

const CONFIG_PATH = './config';
const SKILLS_PATH = './skills';

async function main() {
  // ── Load config ─────────────────────────────────────────────
  const config = loadConfig();
  const configParser = new ConfigParser(CONFIG_PATH);

  logger.setLevel(config.logLevel);

  const toolRegistry = new ToolRegistry({
    timeout: config.tools.timeout,
    allowedPaths: config.tools.allowedPaths,
    blockedCommands: config.tools.blockedCommands
  });
  registerBuiltInTools(toolRegistry);

  const skillsLoader = new SkillsLoader(SKILLS_PATH, toolRegistry);
  await skillsLoader.loadAll();

  const sessionManager = new SessionManager(config.memory);

  // ── Model caller & Agent runtime ────────────────────────────
  const modelCaller = new OpenAICompatibleModelCaller(config.agent);
  const agentRuntime = new AgentRuntimeImpl({
    sessionManager,
    toolRegistry,
    modelCaller,
    config
  });

  // Load identity / soul / user preferences into the engine
  const configs = await configParser.parseAll();
  agentRuntime.setEngineConfig(configs.soul, configs.identity, configs.user);

  // ── Heartbeat ───────────────────────────────────────────────
  const channelRouter = new ChannelRouterImpl(
    {
      async onMessage(message: NormalizedMessage) {
        await handleIncoming(message);
      },
      onError(error: Error) {
        logger.error('Channel error', { error: error.message });
      }
    },
    sessionManager
  );

  const heartbeatScheduler = new HeartbeatScheduler(toolRegistry, channelRouter);
  await heartbeatScheduler.loadTasks(CONFIG_PATH);

  // ── TUI adapter ─────────────────────────────────────────────
  const tui = new TuiAdapter({
    name: 'tui',
    enabled: true,
    sessionId: 'tui-local',
    userId: 'local-user',
    userName: 'Local User',
    showTimestamp: true,
    disableAutoReconnect: true
  });

  channelRouter.registerAdapter(tui);

  // ── Message handling ────────────────────────────────────────
  async function handleIncoming(message: NormalizedMessage): Promise<void> {
    const sessionId = message.sessionId ?? 'tui-local';

    // Ensure session exists
    await sessionManager.getOrCreateSession(
      sessionId,
      message.sender.id,
      message.channel
    );

    // Convert NormalizedMessage → Message for the runtime
    const agentMessage: Message = {
      id: message.id,
      role: 'user',
      content: message.content.text ?? '',
      timestamp: message.timestamp,
      metadata: {
        userId: message.sender.id,
        channel: message.channel,
        senderName: message.sender.name
      }
    };

    try {
      const response = await agentRuntime.processMessage(sessionId, agentMessage);

      // Send response back through the TUI adapter
      await tui.send(message.sender.id, {
        content: { type: 'text', text: response.message }
      });
    } catch (error) {
      logger.error('Failed to process message', { error: (error as Error).message });
      await tui.send(message.sender.id, {
        content: { type: 'text', text: `Error: ${(error as Error).message}` }
      });
    }
  }

  // ── Graceful shutdown ───────────────────────────────────────
  async function shutdown() {
    logger.info('Shutting down...');
    heartbeatScheduler.stop();
    await channelRouter.stopAll();
  }

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  // ── Start ───────────────────────────────────────────────────
  heartbeatScheduler.start();
  await channelRouter.startAll(); // blocks until readline closes
  await shutdown();
  process.exit(0);
}

main().catch((error) => {
  logger.error('Fatal error', { error: (error as Error).message, stack: (error as Error).stack });
  process.exit(1);
});
