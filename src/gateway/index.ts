#!/usr/bin/env node
import { logger } from '../utils/logger.js';
import { loadConfig } from '../config/loader.js';
import { ConfigParser } from '../config/parser.js';
import { ToolRegistry } from '../tools/registry.js';
import { registerBuiltInTools } from '../tools/builtins/index.js';
import { SkillsLoader } from '../tools/skills-loader.js';
import { ChannelRouterImpl } from '../channels/router.js';
import { HeartbeatScheduler } from '../heartbeat/scheduler.js';
import { AgentRuntimeImpl } from '../agent/runtime.js';
import { OpenAICompatibleModelCaller } from '../agent/model/caller.js';
import { SessionManager } from '../agent/session/manager.js';
import { Gateway } from './gateway.js';
import type { NormalizedMessage } from '../types/index.js';

async function main() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║       OpenClaw Minimal Starting         ║');
  console.log('╚════════════════════════════════════════╝\n');

  try {
    const CONFIG_PATH = './config';
    const SKILLS_PATH = './skills';

    logger.info('Initializing components...');

    const config = loadConfig();
    const configParser = new ConfigParser(CONFIG_PATH);

    const toolRegistry = new ToolRegistry({
      timeout: config.tools.timeout,
      allowedPaths: config.tools.allowedPaths,
      blockedCommands: config.tools.blockedCommands
    });
    registerBuiltInTools(toolRegistry);

    const skillsLoader = new SkillsLoader(SKILLS_PATH, toolRegistry);

    let gatewayRef: Gateway | undefined;

    const channelRouter = new ChannelRouterImpl({
      async onMessage(message: NormalizedMessage) {
        if (gatewayRef) {
          await gatewayRef.handleIncomingMessage(message);
        } else {
          logger.warn('Message received before Gateway is ready', {
            channel: message.channel,
            sender: message.sender.id
          });
        }
      },
      onError(error: Error) {
        logger.error('Channel error', { error: error.message });
      }
    });

    const heartbeatScheduler = new HeartbeatScheduler(toolRegistry, channelRouter);

    const sessionManager = new SessionManager(config.memory);
    const modelCaller = new OpenAICompatibleModelCaller(config.agent);
    const agentRuntime = new AgentRuntimeImpl({
      sessionManager,
      toolRegistry,
      modelCaller,
      config
    });

    const gateway = new Gateway({
      config,
      toolRegistry,
      sessionManager,
      agentRuntime,
      channelRouter,
      skillsLoader,
      configParser,
      heartbeatScheduler
    });
    gatewayRef = gateway;

    process.on('SIGINT', async () => {
      logger.info('\nReceived SIGINT, shutting down...');
      await gateway.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('\nReceived SIGTERM, shutting down...');
      await gateway.stop();
      process.exit(0);
    });

    await gateway.start();

    console.log('\n✅ OpenClaw Minimal is running!');
    console.log('\n📁 Configuration path:', CONFIG_PATH);
    console.log('📦 Skills path:', SKILLS_PATH);
    console.log('\n💡 Next steps:');
    console.log('   1. Configure your Telegram bot token in environment variables');
    console.log("   2. Edit config/SOUL.md to customize your agent's values");
    console.log("   3. Edit config/IDENTITY.md to set your agent's personality");
    console.log('   4. Add your own skills in skills/ directory');
    console.log('\n');
  } catch (error) {
    logger.error('Failed to start OpenClaw', {
      error: (error as Error).message,
      stack: (error as Error).stack
    });
    process.exit(1);
  }
}

main();
