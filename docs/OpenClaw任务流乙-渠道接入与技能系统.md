# OpenClaw最小化实现 - 任务流乙

## 文档综述

### 项目概述

本项目旨在以最小化实现为原则，构建一个简洁但功能完整的OpenClaw风格AI Agent框架。通过两人协作的方式，从零开始实现OpenClaw的核心功能，建立起一个可运行的技术框架。

项目的核心目标是实现一个本地优先的AI Agent执行网关，能够通过通讯渠道接收用户指令，调用大语言模型进行推理，并通过标准化的工具调用机制执行实际任务，同时保持对话记忆和主动服务能力。

### 架构总览

基于OpenClaw的技术文档，最小化实现需要包含以下核心组件：

```
┌────────────────────────────────────────────────────────────────┐
│                      Gateway（网关）                            │
│                   Node.js常驻进程                               │
│    消息路由 │ 会话管理 │ 上下文构建 │ 工具调度                   │
└────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Channel Adapter  │ │   Agent Runtime  │ │  Skills Platform  │
│    渠道适配器    │ │   Agent运行时   │ │    技能平台       │
│  统一消息格式    │ │  ReAct推理循环  │ │   工具注册调用    │
└──────────────────┘ └──────────────────┘ └──────────────────┘
              │               │               │
              │               │               │
              ▼               ▼               ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│   配置文件层     │ │    LLM调用层     │ │   本地存储层      │
│  SOUL.md/IDENTITY│ │   模型抽象接口   │ │  Memory/Heartbeat│
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

任务流甲负责：Gateway主进程、Agent Runtime、工具调用系统、上下文与会话管理。

任务流乙负责：Channel Adapter框架、Telegram适配器、Skills技能平台、用户配置系统、Heartbeat调度器。

### 任务分解原则

**独立性原则**：每个任务流应该尽可能独立开发，减少相互依赖。接口和约定一旦确定，两边可以并行开发而无需等待对方完成具体实现。

**接口先行原则**：在开始具体实现之前，双方首先协商并确定模块之间的接口定义。明确的接口是并行开发的基础保障。

**功能完整性原则**：分解后的两个任务流完成后，合并应能得到一个完整可运行的系统。不存在缺失的关键功能。

**工作负载平衡原则**：两个任务的复杂度应尽量均衡，确保两位开发者的工作量大致相当。

---

## 一、任务流乙：渠道接入与技能系统

### １.１　任务流乙概述

任务流乙负责实现OpenClaw的外部交互层和扩展系统，包括Channel Adapters渠道适配器、Skills技能平台、以及用户配置和身份系统。这是整个系统的「感官」和「技能库」，决定了用户如何与Agent交互以及Agent能够执行哪些具体操作。

### １.２　核心职责

任务流乙的开发者在整个项目中承担以下核心职责：

负责设计和实现Channel Adapter框架，包括通用消息格式定义、渠道连接管理、消息收发处理、以及多渠道并发支持。

负责实现至少一个渠道适配器作为示例，建议选择Telegram，因其API相对简单且易于测试。后续可以扩展支持更多渠道。

负责实现Skills技能平台，包括技能加载机制、Skill文件格式定义、以及技能执行接口。需要实现几个基础的示例技能来演示功能。

负责实现用户配置系统，包括SOUL.md、IDENTITY.md、USER.md等配置文件的解析和应用。这些文件决定了Agent的行为方式和与用户的交互风格。

负责实现Heartbeat调度器，这是系统主动服务能力的基础。Heartbeat允许配置定时任务，使Agent能够在特定时间自动执行操作。

### １.３　技术要求

任务流乙同样使用Node.js和TypeScript开发，与任务流甲保持技术栈一致。

Channel Adapter需要实现标准化的接口规范，确保新渠道的添加不会影响核心系统和其他渠道的正常运行。

技能格式应采用Markdown为主的格式，便于人类阅读和维护，同时提供必要的元数据供系统解析。

配置文件采用人类可读的格式，如Markdown和YAML，便于用户直接编辑和理解Agent的配置。

---

## 二、具体实现内容

### ２.１　Channel Adapter框架

Channel Adapter框架需要实现以下功能：

**消息标准化模块**负责定义OpenClaw内部统一的消息格式。这个格式需要包含消息ID、发送者信息、接收者信息、内容（支持文本和富媒体）、时间戳、以及附件信息。消息标准化是支持多渠道的基础。

**适配器基类**为每种具体渠道的适配器提供统一的父类。基类定义init（初始化连接）、send（发送消息）、receive（接收消息）、stop（停止连接）等抽象方法。适配器基类还应提供错误处理和重连机制。

**消息路由**负责将接收到的消息分发给对应的会话处理逻辑。当收到新消息时，路由需要确定消息所属的会话，并触发相应的处理流程。

**多渠道协调**确保来自同一用户的不同渠道的消息能够正确关联，同一会话可以跨越多个渠道保持上下文连续性。

#### 消息标准化

```typescript
// src/channels/normalized-message.ts
interface NormalizedMessage {
  id: string;
  channel: string;
  sender: MessageSender;
  recipient: MessageRecipient;
  content: MessageContent;
  timestamp: Date;
  attachments?: Attachment[];
  metadata: MessageMetadata;
}

interface MessageSender {
  id: string;
  name?: string;
  username?: string;
  isBot: boolean;
}

interface MessageRecipient {
  id: string;
  type: 'user' | 'channel' | 'group';
}

interface MessageContent {
  type: 'text' | 'image' | 'audio' | 'video' | 'file' | 'location';
  text?: string;
  url?: string;
  data?: Record<string, unknown>;
}

interface Attachment {
  type: 'image' | 'audio' | 'video' | 'file';
  url: string;
  filename?: string;
  mimeType?: string;
  size?: number;
}

interface MessageMetadata {
  replyTo?: string;
  mentions?: string[];
  isEdited?: boolean;
  rawPayload?: unknown;
}
```

#### 适配器基类

```typescript
// src/channels/adapter.ts
abstract class BaseChannelAdapter {
  protected config: ChannelConfig;
  protected isRunning: boolean = false;
  protected eventEmitter: EventEmitter;
  
  abstract readonly channelName: string;
  abstract readonly supportedContentTypes: ContentType[];
  
  constructor(config: ChannelConfig, eventEmitter: EventEmitter) {
    this.config = config;
    this.eventEmitter = eventEmitter;
  }
  
  async init(): Promise<void> {
    this.validateConfig();
    await this.setupConnection();
    this.setupEventHandlers();
  }
  
  abstract validateConfig(): void;
  abstract setupConnection(): Promise<void>;
  abstract startListening(): Promise<void>;
  abstract stopListening(): Promise<void>;
  
  abstract send(destination: string, message: OutboundMessage): Promise<void>;
  abstract formatMessage(message: NormalizedMessage): Promise<unknown>;
  
  protected normalizeIncoming(payload: unknown): NormalizedMessage {
    const message = this.extractMessageData(payload);
    return {
      id: this.generateMessageId(),
      channel: this.channelName,
      sender: this.extractSender(payload),
      recipient: this.extractRecipient(payload),
      content: this.extractContent(payload),
      timestamp: new Date(),
      attachments: this.extractAttachments(payload),
      metadata: this.extractMetadata(payload)
    };
  }
  
  protected handleError(error: Error): void {
    this.eventEmitter.emit('error', {
      channel: this.channelName,
      error: error.message,
      timestamp: new Date()
    });
    
    if (this.shouldReconnect(error)) {
      this.scheduleReconnect();
    }
  }
  
  protected async scheduleReconnect(): Promise<void> {
    const delay = this.config.reconnectDelay || 5000;
    setTimeout(async () => {
      try {
        await this.init();
        await this.startListening();
      } catch (error) {
        this.handleError(error as Error);
      }
    }, delay);
  }
  
  private shouldReconnect(error: Error): boolean {
    return !this.config.disableAutoReconnect && 
           this.isRetryableError(error);
  }
  
  private isRetryableError(error: Error): boolean {
    const retryablePatterns = [
      'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED',
      'network', 'timeout', 'unavailable'
    ];
    return retryablePatterns.some(pattern =>
      error.message.toLowerCase().includes(pattern.toLowerCase())
    );
  }
}
```

#### 消息路由

```typescript
// src/channels/router.ts
interface ChannelRouter {
  registerAdapter(adapter: BaseChannelAdapter): void;
  unregisterAdapter(channelName: string): void;
  getAdapter(channelName: string): BaseChannelAdapter | undefined;
  routeMessage(message: NormalizedMessage): Promise<void>;
}

class ChannelRouterImpl implements ChannelRouter {
  private adapters: Map<string, BaseChannelAdapter>;
  private messageHandler: MessageHandler;
  
  constructor(messageHandler: MessageHandler) {
    this.adapters = new Map();
    this.messageHandler = messageHandler;
  }
  
  registerAdapter(adapter: BaseChannelAdapter): void {
    adapter.on('message', async (message: NormalizedMessage) => {
      await this.routeMessage(message);
    });
    
    this.adapters.set(adapter.channelName, adapter);
  }
  
  async routeMessage(message: NormalizedMessage): Promise<void> {
    const sessionId = await this.resolveSession(message);
    
    await this.messageHandler.onMessage({
      ...message,
      sessionId
    });
  }
  
  private async resolveSession(message: NormalizedMessage): Promise<string> {
    const existingSession = await this.findExistingSession(message);
    if (existingSession) {
      return existingSession;
    }
    
    return this.createNewSession(message);
  }
  
  private async findExistingSession(
    message: NormalizedMessage
  ): Promise<string | undefined> {
    return undefined;
  }
  
  private async createNewSession(message: NormalizedMessage): Promise<string> {
    return `session_${Date.now()}_${message.sender.id}`;
  }
}
```

### ２.２　Telegram适配器实现

作为示例渠道，Telegram适配器需要实现以下功能：

**Webhook接收模式**允许Telegram通过Webhook将消息推送到Gateway。这需要配置URL并处理Telegram的签名验证。

**轮询接收模式**作为Webhook的替代方案，通过定期调用Telegram API获取更新。

**消息发送功能**将Agent的响应发送回Telegram聊天。这包括文本消息、Markdown格式消息、以及图片和文件支持。

**命令处理**支持Telegram机器人的命令机制，如/start、/help等内置命令，以及用户自定义命令。

**键盘和按钮**支持Telegram的内联键盘和回复键盘，为用户提供交互式操作选项。

#### Telegram适配器实现

```typescript
// src/channels/telegram/adapter.ts
import { BaseChannelAdapter } from '../adapter';
import { ChannelConfig, OutboundMessage } from '../types';
import axios from 'axios';
import crypto from 'crypto';

interface TelegramConfig extends ChannelConfig {
  botToken: string;
  webhookSecret: string;
  pollingInterval?: number;
}

class TelegramAdapter extends BaseChannelAdapter {
  readonly channelName = 'telegram';
  readonly supportedContentTypes: ContentType[] = [
    'text', 'image', 'audio', 'video', 'file', 'location'
  ];
  
  private apiBase: string;
  private updateOffset: number = 0;
  private pollingTimer?: NodeJS.Timeout;
  
  constructor(config: TelegramConfig, eventEmitter: EventEmitter) {
    super(config, eventEmitter);
    this.apiBase = `https://api.telegram.org/bot${config.botToken}`;
  }
  
  validateConfig(): void {
    if (!this.config.botToken) {
      throw new Error('Telegram bot token is required');
    }
    if (!this.config.webhookSecret) {
      throw new Error('Webhook secret is required');
    }
  }
  
  async setupConnection(): Promise<void> {
    const me = await this.apiCall('getMe');
    if (!me.ok) {
      throw new Error(`Failed to connect to Telegram: ${me.description}`);
    }
  }
  
  async startListening(): Promise<void> {
    if (this.config.useWebhook) {
      await this.setupWebhook();
    } else {
      this.startPolling();
    }
  }
  
  private async setupWebhook(): Promise<void> {
    const webhookUrl = `${this.config.webhookUrl}/channels/telegram/webhook`;
    const secret = this.config.webhookSecret;
    
    await this.apiCall('setWebhook', {
      url: webhookUrl,
      secret_token: secret
    });
  }
  
  private startPolling(): void {
    this.pollingTimer = setInterval(async () => {
      try {
        await this.fetchUpdates();
      } catch (error) {
        this.handleError(error as Error);
      }
    }, this.config.pollingInterval || 1000);
  }
  
  private async fetchUpdates(): Promise<void> {
    const response = await this.apiCall('getUpdates', {
      offset: this.updateOffset,
      timeout: 30,
      allowed_updates: ['message', 'edited_message', 'callback_query']
    });
    
    if (response.ok && response.result.length > 0) {
      for (const update of response.result) {
        await this.processUpdate(update);
        this.updateOffset = update.update_id + 1;
      }
    }
  }
  
  private async processUpdate(update: TelegramUpdate): Promise<void> {
    if (update.message) {
      const message = this.normalizeIncoming(update.message);
      this.eventEmitter.emit('message', message);
    }
    
    if (update.callback_query) {
      const query = update.callback_query;
      this.eventEmitter.emit('callback', {
        id: query.id,
        from: query.from,
        data: query.data,
        message: query.message
      });
    }
  }
  
  protected extractMessageData(payload: TelegramMessage): TelegramMessageData {
    return {
      id: String(payload.message_id),
      sender: payload.from,
      chat: payload.chat,
      text: payload.text || '',
      date: payload.date
    };
  }
  
  protected extractSender(payload: unknown): MessageSender {
    const msg = payload as TelegramMessage;
    return {
      id: String(msg.from?.id || msg.chat?.id),
      name: msg.from?.first_name,
      username: msg.from?.username,
      isBot: msg.from?.is_bot || false
    };
  }
  
  async send(destination: string, message: OutboundMessage): Promise<void> {
    const params: Record<string, unknown> = {
      chat_id: destination,
      parse_mode: 'MarkdownV2'
    };
    
    if (message.content.type === 'text') {
      params.text = message.content.text;
      
      if (message.replyMarkup) {
        params.reply_markup = this.formatReplyMarkup(message.replyMarkup);
      }
    } else if (message.content.type === 'image') {
      params.photo = message.content.url;
      params.caption = message.content.text;
    }
    
    await this.apiCall('sendMessage', params);
  }
  
  private formatReplyMarkup(markup: ReplyMarkup): Record<string, unknown> {
    if (markup.type === 'inline') {
      return {
        inline_keyboard: markup.buttons.map(row =>
          row.map(btn => ({
            text: btn.text,
            url: btn.url,
            callback_data: btn.callbackData
          }))
        )
      };
    }
    
    return {
      keyboard: markup.buttons.map(row =>
        row.map(btn => ({ text: btn.text }))
      ),
      resize_keyboard: true
    };
  }
  
  private async apiCall(
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<TelegramApiResponse> {
    try {
      const response = await axios.post(
        `${this.apiBase}/${method}`,
        params,
        { timeout: 30000 }
      );
      return response.data;
    } catch (error) {
      throw new Error(`Telegram API error: ${(error as Error).message}`);
    }
  }
  
  async stop(): Promise<void> {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
    }
    this.isRunning = false;
  }
}
```

### ２.３　Skills技能平台

技能平台需要实现以下功能：

**技能加载器**负责扫描skills目录，加载所有技能模块，并注册到工具系统。每个技能目录应包含README.md描述文件、实现代码、以及可选的配置文件。

**技能格式规范**定义每个技能的结构：

```
skills/
└── example-skill/
    ├── README.md        # 技能描述和使用说明
    ├── skill.yaml       # 元数据配置
    └── index.ts/js      # 技能实现代码
```

**技能执行接口**定义技能与系统交互的方式。技能可以声明自己需要的工具、接收的参数、以及返回的结果格式。

#### 技能加载器

```typescript
// src/skills/loader.ts
interface SkillDefinition {
  name: string;
  version: string;
  description: string;
  author?: string;
  triggers: SkillTrigger[];
  tools: string[];
  permissions?: string[];
}

interface SkillTrigger {
  type: 'keyword' | 'pattern' | 'schedule' | 'event';
  pattern?: string;
  keywords?: string[];
  schedule?: string;
  eventType?: string;
}

class SkillsLoader {
  private skillsPath: string;
  private toolRegistry: ToolRegistry;
  private skills: Map<string, LoadedSkill> = new Map();
  
  constructor(skillsPath: string, toolRegistry: ToolRegistry) {
    this.skillsPath = skillsPath;
    this.toolRegistry = toolRegistry;
  }
  
  async loadAll(): Promise<void> {
    if (!existsSync(this.skillsPath)) {
      return;
    }
    
    const skillDirs = await fs.readdir(this.skillsPath);
    
    for (const dir of skillDirs) {
      const skillPath = join(this.skillsPath, dir);
      const stat = await fs.stat(skillPath);
      
      if (stat.isDirectory()) {
        await this.loadSkill(skillPath, dir);
      }
    }
  }
  
  private async loadSkill(skillPath: string, skillName: string): Promise<void> {
    try {
      const configPath = join(skillPath, 'skill.yaml');
      if (!existsSync(configPath)) {
        console.warn(`Skill ${skillName}: No skill.yaml found, skipping`);
        return;
      }
      
      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = yaml.parse(configContent) as SkillDefinition;
      
      const indexPath = join(skillPath, 'index.ts');
      const indexJsPath = join(skillPath, 'index.js');
      
      let skillModule;
      if (existsSync(indexPath)) {
        skillModule = await import(indexPath);
      } else if (existsSync(indexJsPath)) {
        skillModule = await import(indexJsPath);
      } else {
        console.warn(`Skill ${skillName}: No index.ts/js found, skipping`);
        return;
      }
      
      const skill = {
        ...config,
        module: skillModule.default || skillModule,
        path: skillPath
      };
      
      for (const toolName of config.tools) {
        const tool = skill.module.tools?.[toolName];
        if (tool) {
          this.toolRegistry.registerTool({
            ...tool,
            tags: [...(tool.tags || []), `skill:${config.name}`]
          });
        }
      }
      
      this.skills.set(config.name, skill);
      console.log(`Loaded skill: ${config.name} v${config.version}`);
      
    } catch (error) {
      console.error(`Failed to load skill ${skillName}:`, error);
    }
  }
  
  getSkill(name: string): LoadedSkill | undefined {
    return this.skills.get(name);
  }
  
  listSkills(): SkillDefinition[] {
    return Array.from(this.skills.values()).map(s => ({
      name: s.name,
      version: s.version,
      description: s.description,
      author: s.author,
      triggers: s.triggers,
      tools: s.tools
    }));
  }
  
  async reloadSkill(name: string): Promise<void> {
    const skill = this.skills.get(name);
    if (skill) {
      await this.unloadSkill(name);
      await this.loadSkill(skill.path, name);
    }
  }
  
  async unloadSkill(name: string): Promise<void> {
    const skill = this.skills.get(name);
    if (skill) {
      for (const toolName of skill.tools) {
        this.toolRegistry.unregisterTool(toolName);
      }
      this.skills.delete(name);
    }
  }
}
```

#### 示例技能实现

```typescript
// skills/weather/index.ts
const weatherSkill: SkillModule = {
  name: 'weather',
  version: '1.0.0',
  
  tools: {
    get_weather: {
      name: 'get_weather',
      description: 'Get weather information for a specified city',
      category: 'information',
      parameters: {
        type: 'object',
        properties: {
          city: {
            type: 'string',
            description: 'The name of the city to get weather for'
          },
          units: {
            type: 'string',
            description: 'Temperature units: metric, imperial, or kelvin',
            enum: ['metric', 'imperial', 'kelvin'],
            default: 'metric'
          }
        },
        required: ['city']
      },
      handler: async (params) => {
        const { city, units = 'metric' } = params;
        
        try {
          const apiKey = process.env.WEATHER_API_KEY;
          if (!apiKey) {
            return { success: false, error: 'Weather API key not configured' };
          }
          
          const response = await axios.get(
            'https://api.openweathermap.org/data/2.5/weather',
            {
              params: { q: city, units, appid: apiKey }
            }
          );
          
          const data = response.data;
          return {
            success: true,
            output: `Weather in ${data.name}: ${data.weather[0].description}. ` +
                    `Temperature: ${data.main.temp}°${units === 'metric' ? 'C' : units === 'imperial' ? 'F' : 'K'}. ` +
                    `Humidity: ${data.main.humidity}%`
          };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }
    }
  },
  
  triggers: [
    {
      type: 'keyword',
      keywords: ['weather', '温度', '天气', 'forecast']
    }
  ]
};

export default weatherSkill;
```

```typescript
// skills/reminder/index.ts
const reminderSkill: SkillModule = {
  name: 'reminder',
  version: '1.0.0',
  
  tools: {
    set_reminder: {
      name: 'set_reminder',
      description: 'Set a reminder that will notify you at the specified time',
      category: 'productivity',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'The reminder message'
          },
          time: {
            type: 'string',
            description: 'When to remind: ISO date string or cron expression'
          }
        },
        required: ['message', 'time']
      },
      handler: async (params, context) => {
        const { message, time } = params;
        const reminderTime = new Date(time);
        
        if (isNaN(reminderTime.getTime())) {
          return { success: false, error: 'Invalid date format' };
        }
        
        const delay = reminderTime.getTime() - Date.now();
        if (delay < 0) {
          return { success: false, error: 'Reminder time is in the past' };
        }
        
        setTimeout(async () => {
          await this.notifyUser(context.sessionId, message);
        }, delay);
        
        return {
          success: true,
          output: `Reminder set for ${reminderTime.toLocaleString()}`
        };
      }
    },
    
    list_reminders: {
      name: 'list_reminders',
      description: 'List all active reminders',
      category: 'productivity',
      parameters: {
        type: 'object',
        properties: {}
      },
      handler: async () => {
        const reminders = await this.getStoredReminders();
        if (reminders.length === 0) {
          return { success: true, output: 'No active reminders' };
        }
        
        return {
          success: true,
          output: reminders.map((r, i) => 
            `${i + 1}. ${r.message} - ${new Date(r.time).toLocaleString()}`
          ).join('\n')
        };
      }
    }
  },
  
  triggers: [
    {
      type: 'keyword',
      keywords: ['remind', '提醒', '闹钟', 'schedule']
    }
  ]
};

export default reminderSkill;
```

```typescript
// skills/web-search/index.ts
const webSearchSkill: SkillModule = {
  name: 'web-search',
  version: '1.0.0',
  
  tools: {
    web_search: {
      name: 'web_search',
      description: 'Search the web and return relevant results',
      category: 'information',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query'
          },
          numResults: {
            type: 'number',
            description: 'Number of results to return',
            default: 5
          }
        },
        required: ['query']
      },
      handler: async (params) => {
        const { query, numResults = 5 } = params;
        
        try {
          const apiKey = process.env.SEARCH_API_KEY;
          if (!apiKey) {
            return { success: false, error: 'Search API key not configured' };
          }
          
          const response = await axios.post(
            'https://api.search.example.com/search',
            {
              query,
              numResults
            },
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          const results = response.data.results
            .map((r: SearchResult, i: number) => 
              `${i + 1}. ${r.title}\n   ${r.snippet}\n   ${r.url}`
            )
            .join('\n\n');
          
          return {
            success: true,
            output: `Search results for "${query}":\n\n${results}`
          };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }
    }
  },
  
  triggers: [
    {
      type: 'keyword',
      keywords: ['search', '查找', '搜索', 'look up']
    }
  ]
};

export default webSearchSkill;
```

### ２.４　用户配置系统

用户配置系统需要解析和应用以下配置文件：

**SOUL.md**是Agent的核心行为定义文件，使用自然语言描述Agent的价值观、行为准则和工作方式。文件内容会被注入到系统Prompt中，影响Agent的回复风格。

**IDENTITY.md**定义Agent的身份特征，包括名称、年龄、背景故事、性格特点等。这些信息帮助塑造Agent的独特个性。

**USER.md**存储用户的个人信息和偏好，包括用户的姓名、工作背景、常用语言、偏好设置等。这些信息帮助Agent提供更个性化的服务。

#### 配置解析器

```typescript
// src/config/parser.ts
interface SoulConfig {
  values: string;
  behavior: string[];
  guidelines: string[];
}

interface IdentityConfig {
  name: string;
  age?: string;
  background: string;
  personality: string[];
  traits: string[];
  greeting?: string;
}

interface UserPreferences {
  name: string;
  language: string;
  timezone: string;
  channels: string[];
  notificationPreferences: NotificationPreferences;
}

class ConfigParser {
  private configPath: string;
  
  constructor(configPath: string) {
    this.configPath = configPath;
  }
  
  async parseSoul(): Promise<SoulConfig> {
    const soulPath = join(this.configPath, 'SOUL.md');
    if (!existsSync(soulPath)) {
      return this.getDefaultSoul();
    }
    
    const content = await fs.readFile(soulPath, 'utf-8');
    return this.parseSoulMarkdown(content);
  }
  
  async parseIdentity(): Promise<IdentityConfig> {
    const identityPath = join(this.configPath, 'IDENTITY.md');
    if (!existsSync(identityPath)) {
      return this.getDefaultIdentity();
    }
    
    const content = await fs.readFile(identityPath, 'utf-8');
    return this.parseIdentityMarkdown(content);
  }
  
  async parseUserPreferences(): Promise<UserPreferences> {
    const userPath = join(this.configPath, 'USER.md');
    if (!existsSync(userPath)) {
      return this.getDefaultUserPreferences();
    }
    
    const content = await fs.readFile(userPath, 'utf-8');
    return this.parseUserMarkdown(content);
  }
  
  private parseSoulMarkdown(content: string): SoulConfig {
    const sections = this.splitSections(content);
    
    return {
      values: sections.values || '',
      behavior: this.extractList(sections.behavior || sections.directives || ''),
      guidelines: this.extractList(sections.guidelines || sections.rules || '')
    };
  }
  
  private parseIdentityMarkdown(content: string): IdentityConfig {
    const sections = this.splitSections(content);
    
    return {
      name: sections.name || 'Assistant',
      age: sections.age,
      background: sections.background || sections.about || '',
      personality: this.extractList(sections.personality || sections.traits || ''),
      traits: this.extractList(sections.personality || sections.traits || ''),
      greeting: sections.greeting
    };
  }
  
  private parseUserMarkdown(content: string): UserPreferences {
    const sections = this.splitSections(content);
    
    return {
      name: sections.name || 'User',
      language: sections.language || 'en',
      timezone: sections.timezone || 'UTC',
      channels: this.extractList(sections.channels || ''),
      notificationPreferences: {
        enabled: sections.notifications !== 'disabled',
        quietHours: sections.quietHours
      }
    };
  }
  
  private splitSections(content: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const lines = content.split('\n');
    let currentSection = '';
    let currentContent: string[] = [];
    
    for (const line of lines) {
      const sectionMatch = line.match(/^##?\s+(.+)$/);
      if (sectionMatch) {
        if (currentSection) {
          sections[currentSection.toLowerCase()] = currentContent.join('\n');
        }
        currentSection = sectionMatch[1].trim();
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }
    
    if (currentSection) {
      sections[currentSection.toLowerCase()] = currentContent.join('\n');
    }
    
    return sections;
  }
  
  private extractList(content: string): string[] {
    return content
      .split('\n')
      .map(line => line.replace(/^[-*]\s*/, '').trim())
      .filter(line => line.length > 0);
  }
  
  private getDefaultSoul(): SoulConfig {
    return {
      values: 'Be helpful, honest, and respectful.',
      behavior: [
        'Be concise and to the point',
        'Ask clarifying questions when needed',
        'Admit when you do not know something'
      ],
      guidelines: [
        'Do not make up information',
        'Respect user privacy'
      ]
    };
  }
  
  private getDefaultIdentity(): IdentityConfig {
    return {
      name: 'Assistant',
      background: 'An AI assistant designed to help users with various tasks.',
      personality: ['Helpful', 'Friendly', 'Professional'],
      traits: ['Patient', 'Knowledgeable', 'Reliable']
    };
  }
  
  private getDefaultUserPreferences(): UserPreferences {
    return {
      name: 'User',
      language: 'en',
      timezone: 'UTC',
      channels: [],
      notificationPreferences: {
        enabled: true
      }
    };
  }
}
```

### ２.５　Heartbeat调度器

Heartbeat调度器需要实现以下功能：

**任务配置解析**读取HEARTBEAT.md文件，解析其中的任务定义。每个任务包含触发条件（使用cron表达式）、任务描述、以及关联的技能或直接的操作指令。

**定时执行器**根据cron表达式计算下次执行时间，在指定时刻触发任务。这需要处理服务器时区和夏令时问题。

**任务队列管理**管理多个定时任务的执行，包括并发控制、错误处理和重试机制。

**任务结果通知**将任务执行结果通过配置的渠道通知给用户。

#### Heartbeat实现

```typescript
// src/heartbeat/scheduler.ts
interface HeartbeatTask {
  id: string;
  name: string;
  description: string;
  schedule: string;
  enabled: boolean;
  actions: HeartbeatAction[];
  timezone?: string;
  metadata?: Record<string, unknown>;
}

interface HeartbeatAction {
  type: 'skill' | 'command' | 'notification';
  skill?: string;
  params?: Record<string, unknown>;
  command?: string;
  message?: string;
  channel?: string;
}

interface ScheduledTask {
  task: HeartbeatTask;
  nextRun: Date;
  lastRun?: Date;
  lastResult?: TaskResult;
}

class HeartbeatScheduler {
  private tasks: Map<string, ScheduledTask> = new Map();
  private cronParser: CronParser;
  private toolRegistry: ToolRegistry;
  private channelRouter: ChannelRouter;
  private checkInterval: NodeJS.Timeout;
  
  constructor(
    toolRegistry: ToolRegistry,
    channelRouter: ChannelRouter,
    configPath: string
  ) {
    this.cronParser = new CronParser();
    this.toolRegistry = toolRegistry;
    this.channelRouter = channelRouter;
  }
  
  async loadTasks(configPath: string): Promise<void> {
    const heartbeatPath = join(configPath, 'HEARTBEAT.md');
    if (!existsSync(heartbeatPath)) {
      console.info('No HEARTBEAT.md found, heartbeat scheduler not enabled');
      return;
    }
    
    const content = await fs.readFile(heartbeatPath, 'utf-8');
    const tasks = this.parseHeartbeatConfig(content);
    
    for (const task of tasks) {
      await this.registerTask(task);
    }
    
    console.info(`Loaded ${tasks.length} heartbeat tasks`);
  }
  
  async registerTask(taskDef: HeartbeatTask): Promise<void> {
    const nextRun = this.cronParser.getNextRun(
      taskDef.schedule,
      taskDef.timezone
    );
    
    const scheduledTask: ScheduledTask = {
      task: taskDef,
      nextRun
    };
    
    this.tasks.set(taskDef.id, scheduledTask);
    console.info(`Registered heartbeat task: ${taskDef.name}, next run: ${nextRun}`);
  }
  
  start(): void {
    this.checkInterval = setInterval(() => {
      this.checkAndExecuteTasks();
    }, 60000);
  }
  
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
  
  private async checkAndExecuteTasks(): Promise<void> {
    const now = new Date();
    
    for (const [taskId, scheduledTask] of this.tasks) {
      if (!scheduledTask.task.enabled) continue;
      
      if (scheduledTask.nextRun <= now) {
        await this.executeTask(scheduledTask);
        
        scheduledTask.lastRun = now;
        scheduledTask.nextRun = this.cronParser.getNextRun(
          scheduledTask.task.schedule,
          scheduledTask.task.timezone
        );
      }
    }
  }
  
  private async executeTask(scheduledTask: ScheduledTask): Promise<void> {
    const { task } = scheduledTask;
    console.info(`Executing heartbeat task: ${task.name}`);
    
    try {
      for (const action of task.actions) {
        await this.executeAction(action, task);
      }
      
      scheduledTask.lastResult = {
        success: true,
        executedAt: new Date()
      };
      
    } catch (error) {
      console.error(`Heartbeat task failed: ${task.name}`, error);
      
      scheduledTask.lastResult = {
        success: false,
        executedAt: new Date(),
        error: (error as Error).message
      };
    }
  }
  
  private async executeAction(action: HeartbeatAction, task: HeartbeatTask): Promise<void> {
    switch (action.type) {
      case 'skill':
        if (action.skill) {
          await this.toolRegistry.executeTool(
            action.skill,
            action.params || {}
          );
        }
        break;
        
      case 'notification':
        if (action.message && action.channel) {
          const adapter = this.channelRouter.getAdapter(action.channel);
          if (adapter) {
            await adapter.send(task.id, {
              content: {
                type: 'text',
                text: action.message
              }
            });
          }
        }
        break;
        
      case 'command':
        if (action.command) {
          await this.toolRegistry.executeTool('shell', {
            command: action.command
          });
        }
        break;
    }
  }
  
  private parseHeartbeatConfig(content: string): HeartbeatTask[] {
    const tasks: HeartbeatTask[] = [];
    const taskBlocks = content.split(/^###\s+/m).filter(Boolean);
    
    for (const block of taskBlocks) {
      const lines = block.split('\n');
      const name = lines[0].trim();
      
      const task: HeartbeatTask = {
        id: this.generateTaskId(name),
        name,
        description: '',
        schedule: '',
        enabled: true,
        actions: []
      };
      
      for (const line of lines.slice(1)) {
        const match = line.match(/^(schedule|when|timezone):\s*(.+)$/i);
        if (match) {
          const [, key, value] = match;
          if (key.toLowerCase() === 'schedule') {
            task.schedule = value;
          } else if (key.toLowerCase() === 'timezone') {
            task.timezone = value;
          }
        }
        
        const actionMatch = line.match(/^-\s*(.+)$/);
        if (actionMatch) {
          const actionStr = actionMatch[1].trim();
          task.actions.push(...this.parseActionString(actionStr));
        }
      }
      
      if (task.schedule && task.actions.length > 0) {
        tasks.push(task);
      }
    }
    
    return tasks;
  }
  
  private parseActionString(actionStr: string): HeartbeatAction[] {
    const actions: HeartbeatAction[] = [];
    
    if (actionStr.startsWith('skill:')) {
      const skillPart = actionStr.substring(6).trim();
      const [skill, ...paramParts] = skillPart.split('|').map(s => s.trim());
      const params = paramParts.length > 0 
        ? JSON.parse(paramParts.join(' '))
        : undefined;
      
      actions.push({ type: 'skill', skill, params });
    } else if (actionStr.startsWith('notify:')) {
      const message = actionStr.substring(7).trim();
      actions.push({ type: 'notification', message });
    } else if (actionStr.startsWith('run:')) {
      const command = actionStr.substring(4).trim();
      actions.push({ type: 'command', command });
    }
    
    return actions;
  }
}
```

---

## 三、模块接口定义

### ３.１　Gateway与Channel Adapter的接口

```typescript
// src/channels/types.ts
interface ChannelConfig {
  name: string;
  enabled: boolean;
  reconnectDelay?: number;
  disableAutoReconnect?: boolean;
  useWebhook?: boolean;
  webhookUrl?: string;
}

interface OutboundMessage {
  content: MessageContent;
  replyTo?: string;
  replyMarkup?: ReplyMarkup;
}

interface ReplyMarkup {
  type: 'inline' | 'reply';
  buttons: ReplyButton[][];
}

interface ReplyButton {
  text: string;
  url?: string;
  callbackData?: string;
}

interface MessageHandler {
  onMessage(message: NormalizedMessage): Promise<void>;
  onError(error: Error): void;
}
```

### ３.２　配置文件的接口

```typescript
// src/config/types.ts
interface SoulConfig {
  values: string;
  behavior: string[];
  guidelines: string[];
}

interface IdentityConfig {
  name: string;
  age?: string;
  background: string;
  personality: string[];
  traits: string[];
  greeting?: string;
}

interface UserPreferences {
  name: string;
  language: string;
  timezone: string;
  channels: string[];
  notificationPreferences: NotificationPreferences;
}

interface NotificationPreferences {
  enabled: boolean;
  quietHours?: string;
}
```

---

## 四、验收标准

任务流乙完成后，应满足以下验收标准：

Channel Adapter框架能够正常工作，能够接收和发送消息，能够处理多种消息类型。

Telegram适配器能够成功连接到Telegram Bot API，能够接收用户消息并发送回复。

Skills平台能够加载和注册技能，能够通过自然语言触发技能执行，能够正确传递参数和处理结果。

配置文件能够被正确解析，能够影响Agent的行为和响应。

Heartbeat能够正确执行定时任务，能够发送任务结果通知。

---

## 五、代码规范

### ５.１　项目结构

```
src/
├── channels/         # 渠道适配器
│   ├── adapter.ts     # 适配器基类
│   ├── router.ts      # 消息路由
│   ├── types.ts       # 类型定义
│   ├── telegram/      # Telegram适配器
│   │   └── adapter.ts
│   └── normalizer.ts  # 消息标准化
├── skills/           # 技能平台
│   ├── loader.ts      # 技能加载器
│   ├── runtime.ts     # 技能执行
│   └── types.ts       # 类型定义
├── config/           # 配置解析
│   ├── parser.ts      # 主解析器
│   └── types.ts       # 类型定义
└── heartbeat/        # 定时调度
    ├── scheduler.ts   # 调度器
    ├── cron.ts        # Cron解析
    └── types.ts       # 类型定义
```

### ５.２　命名规范

与任务流甲保持一致：

| 类型 | 规范 | 示例 |
|-----|------|------|
| 文件名 | kebab-case | telegram-adapter.ts |
| 类名 | PascalCase | TelegramAdapter |
| 接口名 | PascalCase | ChannelConfig |
| 函数名 | camelCase | normalizeMessage |
| 常量名 | UPPER_SNAKE_CASE | DEFAULT_TIMEOUT |

### ５.３　错误处理

```typescript
// src/channels/errors.ts
export class ChannelError extends OpenClawError {
  constructor(message: string, channel: string, cause?: Error) {
    super(message, 'CHANNEL_ERROR', { channel, cause: cause?.message });
    this.name = 'ChannelError';
  }
}

export class SkillLoadError extends OpenClawError {
  constructor(skillName: string, cause: Error) {
    super(
      `Failed to load skill: ${skillName}`,
      'SKILL_LOAD_ERROR',
      { skillName, cause: cause.message }
    );
    this.name = 'SkillLoadError';
  }
}

export class SkillExecutionError extends OpenClawError {
  constructor(skillName: string, toolName: string, cause: Error) {
    super(
      `Skill execution failed: ${skillName}.${toolName}`,
      'SKILL_EXECUTION_ERROR',
      { skillName, toolName, cause: cause.message }
    );
    this.name = 'SkillExecutionError';
  }
}
```

---

## 六、协作说明

### ６.１　与任务流甲的接口对接

任务流乙需要依赖任务流甲定义的以下接口进行开发：

**工具注册表**：任务流乙的Skills系统需要将自己包含的工具注册到任务流甲实现的ToolRegistry中。

**Channel Router**：任务流乙实现的具体适配器需要通过事件或回调将消息传递给任务流甲的Agent Runtime进行处理。

**会话管理**：消息路由需要与任务流甲的会话管理器协调，确保消息正确关联到对应的会话。

### ６.２　开发顺序建议

第一阶段：Channel Adapter框架（1天）

- 实现适配器基类、消息标准化、路由机制

第二阶段：Telegram适配器（1天）

- 实现Telegram Bot连接、Webhook/轮询接收、消息发送

第三阶段：Skills平台（2天）

- 实现技能加载器、格式规范、示例技能

第四阶段：配置系统（1天）

- 实现配置文件解析器

第五阶段：Heartbeat（1天）

- 实现定时调度器

第六阶段：集成与测试（1-2天）

- 与任务流甲进行集成测试

### ６.３　分支策略

```
main           # 稳定版本分支
├── dev        # 开发整合分支
│   ├── feature/gateway-core       # 任务流甲
│   └── feature/channels-skills    # 任务流乙
```

---

## 七、里程碑

### 里程碑一：基础框架搭建（1-2天）

完成Channel Adapter框架设计，实现Telegram适配器基础功能。

交付物：可运行的基础框架，能够启动Gateway并接收Telegram消息。

### 里程碑二：核心功能实现（3-5天）

完成Skills平台基础功能，实现配置文件解析和Heartbeat调度器。

交付物：能够加载技能、解析配置、执行定时任务的完整外部交互层。

### 里程碑三：功能完善与集成（2-3天）

完善技能系统，实现示例技能，优化用户配置。

交付物：功能完善的渠道和技能系统，可与任务流甲成果集成。
