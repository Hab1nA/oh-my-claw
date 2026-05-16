import { logger } from '../utils/index';
import type { NormalizedMessage, OutboundMessage } from '../types/index';
import type { AgentRuntime } from '../agent/runtime.interface.js';
import type { SessionManager } from '../types/index.js';
import type { ChannelRouter } from '../channels/index';
import type { ToolRegistryImpl } from '../tools/index';
import type { SkillsLoader } from '../tools/skills-loader';
import type { ConfigParser } from '../config/parser';
import type { HeartbeatScheduler } from '../heartbeat/scheduler';

/**
 * Gateway主类 - 集成任务流甲和任务流乙
 */
export class Gateway {
  private isRunning: boolean = false;

  constructor(
    private config: {
      configPath: string;
      skillsPath: string;
      port: number;
      host: string;
    },
    private channelRouter: ChannelRouter,
    _toolRegistry: ToolRegistryImpl,
    private skillsLoader: SkillsLoader,
    private configParser: ConfigParser,
    private heartbeatScheduler: HeartbeatScheduler,
    private agentRuntime?: AgentRuntime,
    private sessionManager?: SessionManager
  ) {}

  /**
   * 启动Gateway
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Gateway is already running');
      return;
    }

    logger.info('Starting OpenClaw Gateway...');

    try {
      // 1. 加载配置
      const configs = await this.configParser.parseAll();
      logger.info('Configuration loaded', {
        soul: !!configs.soul,
        identity: !!configs.identity,
        user: !!configs.user
      });

      // 2. 加载技能
      await this.skillsLoader.loadAll();
      logger.info('Skills loaded', { count: this.skillsLoader.getSkillCount() });

      // 3. 加载Heartbeat任务
      await this.heartbeatScheduler.loadTasks(this.config.configPath);
      logger.info('Heartbeat tasks loaded', { count: this.heartbeatScheduler.listTasks().length });

      // 4. 启动渠道适配器
      await this.channelRouter.startAll();
      logger.info('Channel adapters started');

      // 5. 启动Heartbeat调度器
      this.heartbeatScheduler.start();
      logger.info('Heartbeat scheduler started');

      this.isRunning = true;
      logger.info('OpenClaw Gateway started successfully');

      // 注册消息处理器
      this.setupMessageHandler();

    } catch (error) {
      logger.error('Failed to start Gateway', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * 停止Gateway
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping OpenClaw Gateway...');

    try {
      // 按相反顺序停止
      this.heartbeatScheduler.stop();
      await this.channelRouter.stopAll();

      this.isRunning = false;
      logger.info('OpenClaw Gateway stopped');
    } catch (error) {
      logger.error('Error while stopping Gateway', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * 设置消息处理器
   */
  private setupMessageHandler(): void {
    // 在实际实现中，这里会设置 ChannelRouter 的消息处理器
    // 来调用 AgentRuntime.processMessage
  }

  /**
   * 处理传入消息的示例方法
   */
  async handleIncomingMessage(message: NormalizedMessage): Promise<void> {
    logger.debug('Handling incoming message', {
      channel: message.channel,
      sender: message.sender.id,
      text: message.content.text?.substring(0, 100)
    });

    // 如果有Agent Runtime，则委托给它处理
    if (this.agentRuntime) {
      // 1. 转换NormalizedMessage为Agent Runtime可用的Message格式
      const agentMessage = this.convertToAgentMessage(message);

      // 2. 确保会话存在
      const sessionId = message.sessionId || await this.ensureSession(message);

      // 3. 调用Agent Runtime处理
      const response = await this.agentRuntime.processMessage(sessionId, agentMessage);

      // 4. 发送响应回用户
      await this.sendResponse(message, response);

    } else {
      // 简单的回显响应，用于演示
      await this.handleSimpleEcho(message);
    }
  }

  /**
   * 确保会话存在
   */
  private async ensureSession(message: NormalizedMessage): Promise<string> {
    if (this.sessionManager) {
      const session = await this.sessionManager.createSession(
        message.sender.id,
        message.channel
      );
      return session.id;
    }
    // 回退到Channel Router的会话管理
    return message.id;
  }

  /**
   * 转换消息格式
   */
  private convertToAgentMessage(message: NormalizedMessage): any {
    return {
      id: message.id,
      role: 'user',
      content: message.content.text || '',
      timestamp: message.timestamp,
      metadata: message.metadata
    };
  }

  /**
   * 发送响应回用户
   */
  private async sendResponse(
    message: NormalizedMessage,
    response: { message: string; type: string }
  ): Promise<void> {
    const outbound: OutboundMessage = {
      content: {
        type: 'text',
        text: response.message
      },
      replyTo: message.id
    };

    const adapter = this.channelRouter.getAdapter(message.channel);
    if (adapter) {
      await adapter.send(message.recipient.id, outbound);
    }
  }

  /**
   * 简单的回显响应（演示用）
   */
  private async handleSimpleEcho(message: NormalizedMessage): Promise<void> {
    const text = message.content.text;
    if (!text) return;

    let response: string;

    // 检查是否有技能匹配
    const matchedSkills = this.skillsLoader.findMatchingSkills(text);
    if (matchedSkills.length > 0) {
      response = `我识别到你可能需要使用以下技能: ${matchedSkills.map(s => s.name).join(', ')}`;
    } else if (text.toLowerCase().includes('天气')) {
      response = '我可以帮你查询天气，但需要你配置天气API密钥';
    } else if (text.toLowerCase().includes('提醒')) {
      response = '我可以帮你设置提醒，告诉我你想在什么时候提醒你什么';
    } else {
      response = `收到你的消息: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`;
    }

    const outbound: OutboundMessage = {
      content: {
        type: 'text',
        text: response
      }
    };

    const adapter = this.channelRouter.getAdapter(message.channel);
    if (adapter) {
      await adapter.send(message.recipient.id, outbound);
    }
  }
}
