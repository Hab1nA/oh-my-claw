#!/usr/bin/env node
import { logger } from '../utils/index.js';
import { ConfigParser } from '../config/parser.js';
import { ToolRegistryImpl } from '../tools/registry.js';
import { SkillsLoader } from '../tools/skills-loader.js';
import { ChannelRouterImpl } from '../channels/router.js';
import { HeartbeatScheduler } from '../heartbeat/scheduler.js';
import { Gateway } from './gateway.js';
import type { NormalizedMessage } from '../types/index.js';

/**
 * OpenClaw Minimal - 集成示例
 *
 * 这个文件演示了任务流甲和任务流乙的各个组件如何一起工作
 */

async function main() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║       OpenClaw Minimal Starting         ║');
  console.log('╚════════════════════════════════════════╝\n');

  try {
    // 配置路径
    const CONFIG_PATH = './config';
    const SKILLS_PATH = './skills';

    // 1. 初始化核心组件
    logger.info('Initializing components...');

    const configParser = new ConfigParser(CONFIG_PATH);
    const toolRegistry = new ToolRegistryImpl();
    const skillsLoader = new SkillsLoader(SKILLS_PATH, toolRegistry);
    const channelRouter = new ChannelRouterImpl({
      async onMessage(message: NormalizedMessage) {
        logger.info('Message received', {
          channel: message.channel,
          sender: message.sender.id
        });
        // 这里会连接到Agent Runtime
      },
      onError(error: Error) {
        logger.error('Channel error', { error: error.message });
      }
    });
    const heartbeatScheduler = new HeartbeatScheduler(toolRegistry, channelRouter);

    // 2. 创建Gateway
    const gateway = new Gateway(
      {
        configPath: CONFIG_PATH,
        skillsPath: SKILLS_PATH,
        port: 18789,
        host: 'localhost'
      },
      channelRouter as any,
      toolRegistry,
      skillsLoader,
      configParser,
      heartbeatScheduler
    );

    // 3. 设置优雅关闭
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

    // 4. 启动Gateway
    await gateway.start();

    // 5. 打印启动信息
    console.log('\n✅ OpenClaw Minimal is running!');
    console.log('\n📁 Configuration path:', CONFIG_PATH);
    console.log('📦 Skills path:', SKILLS_PATH);
    console.log('\n💡 Next steps:');
    console.log('   1. Configure your Telegram bot token in environment variables');
    console.log('   2. Edit config/SOUL.md to customize your agent\'s values');
    console.log('   3. Edit config/IDENTITY.md to set your agent\'s personality');
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
