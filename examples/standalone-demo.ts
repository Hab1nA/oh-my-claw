#!/usr/bin/env ts-node
import { logger } from '../src/utils/index';
import { ConfigParser } from '../src/config/parser';
import { ToolRegistryImpl } from '../src/tools/registry';
import { SkillsLoader } from '../src/tools/skills-loader';
import { ChannelRouterImpl } from '../src/channels/router';
import { HeartbeatScheduler } from '../src/heartbeat/scheduler';
import type { NormalizedMessage } from '../src/types/index';

/**
 * OpenClaw Minimal - 独立运行示例（无任务流甲依赖）
 *
 * 这个示例展示了仅使用任务流乙组件的运行方式
 */

async function main() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   OpenClaw Minimal Standalone Running    ║');
  console.log('╚════════════════════════════════════════╝\n');

  try {
    const CONFIG_PATH = './config';
    const SKILLS_PATH = './skills';

    logger.info('Initializing OpenClaw components...');

    // 初始化组件
    const configParser = new ConfigParser(CONFIG_PATH);
    const toolRegistry = new ToolRegistryImpl();
    const skillsLoader = new SkillsLoader(SKILLS_PATH, toolRegistry);

    // 创建消息处理器
    const messageHandler = {
      async onMessage(message: NormalizedMessage) {
        logger.info('Message received', {
          channel: message.channel,
          sender: message.sender.id,
          text: message.content.text?.substring(0, 100)
        });

        // 简单的回显逻辑
        const text = message.content.text;
        let responseText = '收到你的消息！';

        // 检查是否有匹配的技能
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

    const channelRouter = new ChannelRouterImpl(messageHandler as any);
    const heartbeatScheduler = new HeartbeatScheduler(toolRegistry, channelRouter as any);

    // 加载配置
    const configs = await configParser.parseAll();
    logger.info('Configuration loaded', {
      soul: !!configs.soul,
      identity: !!configs.identity,
      user: !!configs.user
    });

    // 加载技能
    await skillsLoader.loadAll();
    logger.info('Skills loaded', { count: skillsLoader.getSkillCount() });

    // 加载Heartbeat任务
    await heartbeatScheduler.loadTasks(CONFIG_PATH);
    logger.info('Heartbeat tasks loaded', { count: heartbeatScheduler.listTasks().length });

    // 打印状态
    console.log('\n✅ Components initialized successfully!');
    console.log('\n📊 System status:');
    console.log('   - Config Parser: ready');
    console.log(`   - Tool Registry: ${toolRegistry.getToolCount()} tools`);
    console.log(`   - Skills Loader: ${skillsLoader.getSkillCount()} skills`);
    console.log('   - Channel Router: ready');
    console.log('   - Heartbeat Scheduler: ready');

    // 打印加载的技能
    const skills = skillsLoader.listSkills();
    if (skills.length > 0) {
      console.log('\n📦 Loaded skills:');
      skills.forEach(skill => {
        console.log(`   - ${skill.name} (${skill.version})`);
      });
    }

    // 打印Heartbeat任务
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

    // 设置优雅关闭
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
