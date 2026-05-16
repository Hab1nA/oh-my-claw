# OpenClaw 对接指南

## 概述

本文档说明任务流乙（Channel Adapter、Skills、Config、Heartbeat）如何与任务流甲（Gateway、Agent Runtime、Tool Registry）进行对接。

## 架构设计

```
                    ┌─────────────────────────────┐
                    │   Gateway (任务流甲 + 乙)    │
                    └─────────────┬───────────────┘
                                  │
            ┌─────────────────────┼─────────────────────┐
            │                     │                     │
            ▼                     ▼                     ▼
    ┌──────────────┐    ┌────────────────┐    ┌───────────────┐
    │  Channel     │    │  Agent Runtime │    │   Skills      │
    │  Adapter     │    │  (任务流甲)     │    │   Platform    │
    │  (任务流乙)   │    │                │    │   (任务流乙)   │
    └──────────────┘    └────────────────┘    └───────────────┘
            │                     │                     │
            └─────────────────────┼─────────────────────┘
                                  │
                      ┌───────────┴───────────┐
                      ▼                       ▼
              ┌───────────────┐      ┌──────────────────┐
              │   Config      │      │   Heartbeat      │
              │   Parser      │      │   Scheduler      │
              │   (任务流乙)   │      │   (任务流乙)      │
              └───────────────┘      └──────────────────┘
```

## 关键对接点

### 1. Channel Router → Agent Runtime

**任务流乙（Channel Router）**负责接收来自用户的消息，然后转发给**任务流甲（Agent Runtime）**处理。

#### 接口定义

```typescript
// 在任务流甲中实现
interface AgentRuntime {
  processMessage(sessionId: string, message: Message): Promise<AgentResponse>;
  getSessionState(sessionId: string): Promise<SessionState>;
  abortSession(sessionId: string): Promise<void>;
}
```

#### 使用示例

```typescript
// 在 ChannelRouterImpl 中的实现
export class ChannelRouterImpl {
  constructor(
    private messageHandler: MessageHandler,
    private agentRuntime?: AgentRuntime // 可选，任务流甲提供
  ) {}

  async routeMessage(message: NormalizedMessage): Promise<void> {
    if (this.agentRuntime) {
      // 使用 Agent Runtime 处理
      const sessionId = this.resolveSession(message);
      const response = await this.agentRuntime.processMessage(
        sessionId,
        this.convertToAgentMessage(message)
      );
      await this.sendResponse(message, response);
    } else {
      // 回退到简单处理
      await this.messageHandler.onMessage(message);
    }
  }
}
```

### 2. Skills Platform → Tool Registry

**任务流乙（Skills Loader）**负责扫描技能目录，解析 skill.yaml，然后将工具注册到**任务流甲（Tool Registry）**中。

#### 接口定义

```typescript
// 已在任务流乙中实现
interface ToolRegistry {
  registerTool(tool: ToolDefinition): void;
  unregisterTool(name: string): boolean;
  getTool(name: string): ToolDefinition | undefined;
  listTools(filter?: ToolFilter): ToolDefinition[];
  executeTool(name: string, params: Record<string, unknown>): Promise<ToolResult>;
  hasTool(name: string): boolean;
}
```

#### 使用示例

```typescript
// 在 SkillsLoader 中的实现
export class SkillsLoader {
  constructor(
    private skillsPath: string,
    private toolRegistry: ToolRegistry // 任务流甲提供
  ) {}

  async loadAll(): Promise<void> {
    // 扫描 skills/ 目录
    // 解析 skill.yaml
    // 加载技能模块
    // 注册工具到 ToolRegistry
    for (const toolName of skillModule.tools) {
      const tool = skillModule.tools[toolName];
      this.toolRegistry.registerTool({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        handler: tool.handler,
        category: tool.category,
        tags: [...(tool.tags || []), `skill:${skillName}`]
      });
    }
  }
}
```

### 3. Config Parser → Prompt Builder

**任务流乙（Config Parser）**负责解析 SOUL.md、IDENTITY.md、USER.md，然后提供给**任务流甲（Prompt Builder）**使用。

#### 接口定义

```typescript
// ConfigParser 接口
export interface ConfigParser {
  parseSoul(): Promise<SoulConfig>;
  parseIdentity(): Promise<IdentityConfig>;
  parseUserPreferences(): Promise<UserPreferences>;
  parseAll(): Promise<{
    soul: SoulConfig;
    identity: IdentityConfig;
    user: UserPreferences;
  }>;
  buildSystemPrompt(soul: SoulConfig, identity: IdentityConfig, user: UserPreferences): string;
}
```

#### 使用示例

```typescript
// 在任务流甲的 PromptBuilder 中的使用
class PromptBuilder {
  constructor(private configParser: ConfigParser) {}

  async buildPrompt(sessionId: string): Promise<string> {
    const { soul, identity, user } = await this.configParser.parseAll();

    // 构建系统提示词
    return this.configParser.buildSystemPrompt(soul, identity, user);
  }
}
```

### 4. Heartbeat Scheduler → Tool Registry

**任务流乙（Heartbeat Scheduler）**负责执行定时任务，它直接使用**任务流甲（Tool Registry）**来执行技能。

#### 使用示例

```typescript
// 在 HeartbeatScheduler 中的实现
export class HeartbeatScheduler {
  constructor(
    private toolRegistry: ToolRegistry, // 任务流甲提供
    private channelRouter: ChannelRouter
  ) {}

  private async executeAction(action: HeartbeatAction, task: HeartbeatTask): Promise<void> {
    switch (action.type) {
      case 'skill':
        if (action.skill && this.toolRegistry.hasTool(action.skill)) {
          await this.toolRegistry.executeTool(
            action.skill,
            action.params || {},
            {
              sessionId: task.id,
              userId: 'heartbeat',
              workingDirectory: process.cwd(),
              environment: process.env as Record<string, string>
            }
          );
        }
        break;
      // ... 其他类型
    }
  }
}
```

## 完整初始化流程

```typescript
// 在 gateway/index.ts 中的完整初始化
async function main() {
  // 1. 初始化任务流乙组件
  const configParser = new ConfigParser('./config');
  const toolRegistry = new ToolRegistryImpl(); // 任务流甲/乙共享
  const skillsLoader = new SkillsLoader('./skills', toolRegistry);
  const channelRouter = new ChannelRouterImpl(messageHandler);
  const heartbeatScheduler = new HeartbeatScheduler(toolRegistry, channelRouter);

  // 2. 初始化任务流甲组件 (待实现)
  const agentRuntime = await createAgentRuntime(configParser, toolRegistry);
  const sessionManager = await createSessionManager();

  // 3. 装配组件
  const gateway = new Gateway(
    config,
    channelRouter,
    toolRegistry,
    skillsLoader,
    configParser,
    heartbeatScheduler,
    agentRuntime, // 注入任务流甲组件
    sessionManager
  );

  // 4. 启动
  await gateway.start();
}
```

## 文件结构说明

```
OpenClaw-minimal/
├── src/
│   ├── gateway/                  # Gateway主进程
│   │   ├── index.ts             # 入口点
│   │   └── gateway.ts           # Gateway类
│   ├── channels/                # 渠道适配器（任务流乙）
│   │   ├── adapter.ts
│   │   ├── router.ts
│   │   ├── types.ts
│   │   └── telegram/
│   │       └── adapter.ts
│   ├── tools/                   # 工具和技能（任务流乙）
│   │   ├── registry.ts          # 工具注册表
│   │   ├── skills-loader.ts
│   │   └── index.ts
│   ├── config/                  # 配置解析（任务流乙）
│   │   ├── parser.ts
│   │   └── index.ts
│   ├── heartbeat/               # 心跳调度器（任务流乙）
│   │   ├── cron.ts
│   │   ├── scheduler.ts
│   │   └── index.ts
│   ├── agent/                   # Agent运行时（任务流甲，待实现）
│   │   ├── runtime.interface.ts # 接口定义
│   │   └── ...
│   ├── types/                   # 共享类型
│   │   ├── message.ts
│   │   ├── tool.ts
│   │   ├── session.ts
│   │   ├── config.ts
│   │   ├── skill.ts
│   │   ├── heartbeat.ts
│   │   └── index.ts
│   ├── utils/                   # 工具函数
│   │   ├── errors.ts
│   │   ├── logger.ts
│   │   └── index.ts
│   └── index.ts
├── config/                      # 配置文件
│   ├── SOUL.md
│   ├── IDENTITY.md
│   ├── USER.md
│   └── HEARTBEAT.md
├── skills/                      # 技能目录
│   ├── weather/
│   ├── reminder/
│   └── web-search/
├── examples/
│   └── simple-app.ts
├── package.json
├── tsconfig.json
└── README.md
```

## 任务流甲待实现清单

如果任务流甲还没有实现，下面是需要完成的内容：

1. **Agent Runtime** - 实现 ReAct 循环
2. **LLM Integration** - 连接到大语言模型
3. **Built-in Tools** - 实现文件读写、Shell、HTTP 等工具
4. **Session Manager** - 实现完整的会话管理和持久化
5. **Gateway HTTP/WSS** - 实现控制接口和 WebSocket

## 对接检查清单

- [ ] Channel Router 可以正确调用 AgentRuntime
- [ ] Skills 可以正确注册到 ToolRegistry
- [ ] Config 可以正确解析并用于 Prompt 构建
- [ ] Heartbeat 可以正确调用工具执行任务
- [ ] 类型定义一致且兼容
- [ ] 错误处理机制统一
- [ ] 日志系统集成
- [ ] 集成测试通过

## 下一步

1. 实现任务流甲的核心组件
2. 进行完整的集成测试
3. 添加更多内置工具和技能
4. 优化性能和错误处理
5. 编写更多文档和示例
