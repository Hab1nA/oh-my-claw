import {
  TelegramAdapter,
  ChannelRouterImpl,
  ToolRegistry,
  SkillsLoader,
  ConfigParser,
  HeartbeatScheduler,
  logger
} from './src/index.js';

import type { NormalizedMessage } from './src/types/index.js';

async function main() {
  try {
    logger.info('Starting OpenClaw Minimal...');

    const configParser = new ConfigParser('./config');
    const configs = await configParser.parseAll();

    logger.info('Config loaded', {
      soul: !!configs.soul,
      identity: !!configs.identity,
      user: !!configs.user
    });

    const toolRegistry = new ToolRegistry();
    logger.info('Tool registry initialized');

    const skillsLoader = new SkillsLoader('./skills', toolRegistry);
    await skillsLoader.loadAll();
    logger.info('Skills loaded', { count: skillsLoader.getSkillCount() });

    const messageHandler = {
      async onMessage(message: NormalizedMessage) {
        logger.info('Received message', {
          messageId: message.id,
          channel: message.channel,
          sender: message.sender.id,
          content: message.content.text?.substring(0, 50)
        });

        const matchedSkills = skillsLoader.findMatchingSkills(message.content.text || '');
        if (matchedSkills.length > 0) {
          logger.info('Matched skills', {
            skills: matchedSkills.map(s => s.name)
          });
        }
      },
      onError(error: Error) {
        logger.error('Message handler error', { error: error.message });
      }
    };

    const channelRouter = new ChannelRouterImpl(messageHandler);
    logger.info('Channel router initialized');

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

    const heartbeatScheduler = new HeartbeatScheduler(toolRegistry, channelRouter);
    await heartbeatScheduler.loadTasks('./config');
    logger.info('Heartbeat scheduler initialized', {
      taskCount: heartbeatScheduler.listTasks().length
    });

    await channelRouter.startAll();
    heartbeatScheduler.start();
    logger.info('OpenClaw Minimal started successfully!');

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

main();
