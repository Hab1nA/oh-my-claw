import {
  TelegramAdapter,
  ChannelRouterImpl,
  ToolRegistryImpl,
  SkillsLoader,
  ConfigParser,
  HeartbeatScheduler,
  logger
} from './src';

import type { NormalizedMessage } from './src/types';

async function main() {
  try {
    logger.info('Starting OpenClaw Minimal...');

    // Step 1: Initialize config parser
    const configParser = new ConfigParser('./config');
    const configs = await configParser.parseAll();

    logger.info('Config loaded', {
      soul: !!configs.soul,
      identity: !!configs.identity,
      user: !!configs.user
    });

    // Step 2: Initialize tool registry
    const toolRegistry = new ToolRegistryImpl();
    logger.info('Tool registry initialized');

    // Step 3: Load skills from skills directory
    const skillsLoader = new SkillsLoader('./skills', toolRegistry);
    await skillsLoader.loadAll();
    logger.info('Skills loaded', { count: skillsLoader.getSkillCount() });

    // Step 4: Create message handler
    const messageHandler = {
      async onMessage(message: NormalizedMessage) {
        logger.info('Received message', {
          messageId: message.id,
          channel: message.channel,
          sender: message.sender.id,
          content: message.content.text?.substring(0, 50)
        });

        // Check if message matches any skill triggers
        const matchedSkills = skillsLoader.findMatchingSkills(message.content.text || '');
        if (matchedSkills.length > 0) {
          logger.info('Matched skills', {
            skills: matchedSkills.map(s => s.name)
          });
        }

        // TODO: Pass message to AgentRuntime
        // For now, just log it
      },
      onError(error: Error) {
        logger.error('Message handler error', { error: error.message });
      }
    };

    // Step 5: Initialize channel router
    const channelRouter = new ChannelRouterImpl(messageHandler);
    logger.info('Channel router initialized');

    // Step 6: Register Telegram adapter (if configured)
    if (process.env.TELEGRAM_BOT_TOKEN) {
      const telegramConfig = {
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        name: 'telegram',
        enabled: true,
        useWebhook: !!process.env.TELEGRAM_WEBHOOK_URL,
        webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
        webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
        pollingInterval: 1000
      };

      const telegramAdapter = new TelegramAdapter(telegramConfig);
      channelRouter.registerAdapter(telegramAdapter);
      logger.info('Telegram adapter registered');
    }

    // Step 7: Initialize heartbeat scheduler
    const heartbeatScheduler = new HeartbeatScheduler(toolRegistry, channelRouter);
    await heartbeatScheduler.loadTasks('./config');
    logger.info('Heartbeat scheduler initialized', {
      taskCount: heartbeatScheduler.listTasks().length
    });

    // Step 8: Start everything
    await channelRouter.startAll();
    heartbeatScheduler.start();
    logger.info('OpenClaw Minimal started successfully!');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down...');
      heartbeatScheduler.stop();
      await channelRouter.stopAll();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start', { error: (error as Error).message });
    process.exit(1);
  }
}

// Run the application
main();
