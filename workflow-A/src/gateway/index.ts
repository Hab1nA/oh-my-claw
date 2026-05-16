import { Gateway } from './gateway.js';
import { loadConfig } from './config/loader.js';
import { Logger } from './utils/logger.js';

async function main(): Promise<void> {
  const logger = Logger.getInstance();
  const config = loadConfig();
  logger.setLevel(config.logLevel);

  const gateway = new Gateway(config);

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully');
    await gateway.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully');
    await gateway.stop();
    process.exit(0);
  });

  await gateway.start();
  logger.info(`Gateway started on ${config.host}:${config.port}`);
}

main().catch((error: unknown) => {
  console.error('Failed to start gateway:', error);
  process.exit(1);
});

