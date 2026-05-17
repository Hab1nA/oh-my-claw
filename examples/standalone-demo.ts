#!/usr/bin/env ts-node
import { logger } from '../src/utils/index.js';
import { ConfigParser } from '../src/config/parser.js';
import { ToolRegistry } from '../src/tools/registry.js';
import { SkillsLoader } from '../src/tools/skills-loader.js';
import { ChannelRouterImpl } from '../src/channels/router.js';
import { HeartbeatScheduler } from '../src/heartbeat/scheduler.js';
import type { NormalizedMessage } from '../src/types/index.js';
import type { MessageHandler } from '../src/channels/types.js';

async function main() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   OpenClaw Minimal Standalone Running    ║');
  console.log('╚════════════════════════════════════════╝\n');

  try {
    const CONFIG_PATH = './config';
    const SKILLS_PATH = './skills';

    logger.info('Initializing OpenClaw components...');

    const configParser = new ConfigParser(CONFIG_PATH);
    const toolRegistry = new ToolRegistry();
    const skillsLoader = new SkillsLoader(SKILLS_PATH, toolRegistry);

    const messageHandler: MessageHandler = {
      async onMessage(message: NormalizedMessage) {
        logger.info('Message received', {
          channel: message.channel,
          sender: message.sender.id,
          text: message.content.text?.substring(0, 100)
        });

        const text = message.content.text;
        let responseText = '收到你的消息！';

        const matchedSkills = skillsLoader.findMatchingSkills(text || '');
        if (matchedSkills.length > 0) {
          responseText = `我发现你可能需要这些技能: ${matchedSkills.map(s => s.name).join(', ')}`;
        }

        logger.info('Response ready', { text: responseText });
      },
      onError(error: Error) {
        logger.error('Channel error', { error: error.message });
      }
    };

    const channelRouter = new ChannelRouterImpl(messageHandler);
    const heartbeatScheduler = new HeartbeatScheduler(toolRegistry, channelRouter);

    const configs = await configParser.parseAll();
    logger.info('Configuration loaded', {
      soul: !!configs.soul,
      identity: !!configs.identity,
      user: !!configs.user
    });

    await skillsLoader.loadAll();
    logger.info('Skills loaded', { count: skillsLoader.getSkillCount() });

    await heartbeatScheduler.loadTasks(CONFIG_PATH);
    logger.info('Heartbeat tasks loaded', { count: heartbeatScheduler.listTasks().length });

    console.log('\n✅ Components initialized successfully!');
    console.log('\n📊 System status:');
    console.log('   - Config Parser: ready');
    console.log(`   - Tool Registry: ${toolRegistry.getToolCount()} tools`);
    console.log(`   - Skills Loader: ${skillsLoader.getSkillCount()} skills`);
    console.log('   - Channel Router: ready');
    console.log('   - Heartbeat Scheduler: ready');

    const skills = skillsLoader.listSkills();
    if (skills.length > 0) {
      console.log('\n📦 Loaded skills:');
      skills.forEach(skill => {
        console.log(`   - ${skill.name} (${skill.version})`);
      });
    }

    const tasks = heartbeatScheduler.listTasks();
    if (tasks.length > 0) {
      console.log('\n⏰ Heartbeat tasks:');
      tasks.forEach(task => {
        console.log(`   - ${task.task.name} [${task.task.enabled ? 'enabled' : 'disabled'}]`);
      });
    }

    console.log('\n💡 This is a standalone demo - no actual channels are connected');
    console.log('   To use the full OpenClaw functionality, connect a channel adapter');
    console.log('   or implement the Agent Runtime (task flow 1)\n');

    process.on('SIGINT', async () => {
      logger.info('\nShutting down...');
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('\nShutting down...');
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to run', {
      error: (error as Error).message,
      stack: (error as Error).stack
    });
    process.exit(1);
  }
}

main();
