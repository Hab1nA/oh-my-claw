# OpenClaw最小化实现 - 任务流甲

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

## 一、任务流甲：核心运行时与工具系统

### １.１　任务流甲概述

任务流甲负责实现OpenClaw的核心运行时系统，包括Gateway的主进程架构、Agent Runtime的推理引擎、工具调用执行器、以及与LLM的交互逻辑。这是整个系统的「大脑」和「四肢」，决定了Agent是否能够正确理解用户意图并执行相应操作。

### １.２　核心职责

任务流甲的开发者在整个项目中承担以下核心职责：

负责设计和实现Gateway主进程，包括进程启动、服务初始化、配置加载、以及优雅关闭机制。Gateway需要能够以守护进程的方式运行，处理各种信号，实现日志记录和错误处理。

负责实现Agent Runtime，这是系统的推理核心。Agent Runtime需要实现完整的ReAct循环，包括Prompt构建、LLM调用、响应解析、工具调用决策、以及循环终止条件判断。

负责实现工具调用执行器，这是系统执行实际操作的组件。工具执行器需要支持Shell命令执行、文件读写等基础操作，并提供标准化的工具注册和调用接口，供Skills系统扩展使用。

负责实现与LLM的交互逻辑，包括模型抽象层、请求构建、响应解析、错误处理、以及重试机制。需要支持主流的OpenAI兼容API格式。

负责实现基础的上下文管理，包括会话状态维护、对话历史管理、以及上下文窗口管理。

### １.３　技术要求

任务流甲需要使用Node.js作为运行时环境，采用TypeScript进行类型安全的开发。建议使用Node.js 22或更高版本，以获得更好的性能和最新的语言特性。

模块之间通过清晰的接口进行通信，不直接依赖其他模块的具体实现。所有对外暴露的接口应编写完整的TypeScript类型定义。

日志系统应支持多级别输出（debug、info、warn、error），并支持结构化日志格式，便于问题排查和系统监控。

错误处理应遵循一致的模式，所有异步操作使用Promise或async/await，并妥善处理各种异常情况。

---

## 二、具体实现内容

### ２.１　Gateway主进程

Gateway主进程需要实现以下功能模块：

**进程管理模块**负责处理命令行参数解析、服务启动和停止、进程信号处理（SIGTERM、SIGINT等）、以及守护进程模式的实现。

**配置加载模块**负责从配置文件（YAML或JSON格式）读取系统配置，支持环境变量覆盖，并提供配置验证和默认值处理。

**服务初始化模块**负责按正确顺序初始化各个子系统，包括日志系统、数据库连接（如果有）、消息总线等依赖关系较少的组件优先初始化。

**HTTP/WebSocket服务模块**负责提供控制接口，默认监听18789端口。WebSocket用于实时消息推送，HTTP用于管理接口和健康检查。

#### 关键实现细节

**入口文件结构**应包含：

```typescript
// src/gateway/index.ts
import { Gateway } from './gateway';
import { loadConfig } from './config/loader';
import { Logger } from './utils/logger';

async function main() {
  const logger = Logger.getInstance();
  const config = loadConfig();
  
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
  logger.info(`Gateway started on port ${config.port}`);
}

main().catch((error) => {
  console.error('Failed to start gateway:', error);
  process.exit(1);
});
```

**配置结构**应包含：

```typescript
// src/gateway/config/types.ts
interface GatewayConfig {
  port: number;
  host: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  agent: AgentConfig;
  tools: ToolsConfig;
  memory: MemoryConfig;
}

interface AgentConfig {
  model: string;
  apiKey: string;
  baseUrl?: string;
  maxTokens: number;
  temperature: number;
}

interface ToolsConfig {
  timeout: number;
  allowedPaths: string[];
  blockedCommands: string[];
}

interface MemoryConfig {
  storagePath: string;
  maxHistoryLength: number;
}
```

### ２.２　Agent Runtime

Agent Runtime需要实现以下核心功能：

**Prompt构建器**负责根据当前上下文动态生成发送给LLM的提示词。提示词应包含系统角色定义、用户偏好信息、可用工具描述、会话历史摘要、以及当前任务上下文。Prompt构建器需要支持上下文长度控制，避免超出模型的token限制。

**ReAct循环引擎**负责实现完整的推理循环。引擎需要追踪当前状态，决定是生成回答还是调用工具，处理工具调用的结果，并判断是否已达到任务目标或需要终止循环。

**模型调用器**负责与LLM API交互。这包括构建符合API规范的请求、发送HTTP请求、解析响应、处理流式输出（可选）、以及实现重试和降级逻辑。

#### ReAct循环实现

ReAct循环是Agent的核心推理机制，需要实现以下状态机和循环逻辑：

```typescript
// src/agent/react/engine.ts
enum ReactState {
  THINKING,
  ACTING,
  OBSERVING,
  FINISHED,
  FAILED
}

interface ReactContext {
  sessionId: string;
  messages: Message[];
  tools: ToolDefinition[];
  currentState: ReactState;
  iterationCount: number;
  maxIterations: number;
}

class ReactEngine {
  private modelCaller: ModelCaller;
  private toolRegistry: ToolRegistry;
  
  async run(context: ReactContext): Promise<AgentResponse> {
    while (context.currentState !== ReactState.FINISHED &&
           context.currentState !== ReactState.FAILED &&
           context.iterationCount < context.maxIterations) {
      
      context.currentState = ReactState.THINKING;
      const decision = await this.think(context);
      
      if (decision.shouldRespond) {
        context.currentState = ReactState.FINISHED;
        return { message: decision.response, type: 'final' };
      }
      
      context.currentState = ReactState.ACTING;
      const result = await this.act(context, decision.toolCalls);
      
      context.currentState = ReactState.OBSERVING;
      context.messages.push(...this.formatToolResults(result));
      
      context.iterationCount++;
    }
    
    return this.handleMaxIterations(context);
  }
  
  private async think(context: ReactContext): Promise<ThinkDecision> {
    const prompt = this.buildThinkPrompt(context);
    const response = await this.modelCaller.call(prompt);
    return this.parseThinkResponse(response, context.tools);
  }
  
  private async act(context: ReactContext, toolCalls: ToolCall[]): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    for (const toolCall of toolCalls) {
      const result = await this.toolRegistry.execute(
        toolCall.name,
        toolCall.parameters
      );
      results.push(result);
    }
    return results;
  }
}
```

### ２.３　工具调用系统

工具调用系统需要实现以下功能：

**工具注册表**负责管理系统可用的所有工具。每个工具需要注册名称、描述、参数模式、以及处理函数。工具注册表提供按名称查询和按功能分类查询的接口。

**参数验证器**负责根据工具的schema验证传入的参数。这包括类型检查、必填字段检查、以及自定义验证规则。

**执行器**负责在安全的环境中执行工具调用。需要实现超时控制、错误捕获、以及执行结果序列化。

#### 工具接口定义

```typescript
// src/tools/registry.ts
interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
  handler: ToolHandler;
  category?: string;
  tags?: string[];
}

interface ToolParameterSchema {
  type: 'object';
  properties: Record<string, ParameterDefinition>;
  required?: string[];
}

interface ParameterDefinition {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  default?: unknown;
  enum?: unknown[];
}

type ToolHandler = (
  params: Record<string, unknown>,
  context: ToolExecutionContext
) => Promise<ToolResult>;

interface ToolExecutionContext {
  sessionId: string;
  userId: string;
  workingDirectory: string;
  environment: Record<string, string>;
}

interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}
```

#### 内置工具实现

需要实现以下核心内置工具：

**文件读取工具**：

```typescript
// src/tools/builtins/file-read.ts
export const fileReadTool: ToolDefinition = {
  name: 'file_read',
  description: 'Read the contents of a file from the local filesystem',
  category: 'filesystem',
  tags: ['file', 'read', 'io'],
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The absolute path to the file to read'
      },
      encoding: {
        type: 'string',
        description: 'The file encoding (default: utf-8)',
        default: 'utf-8'
      },
      maxLines: {
        type: 'number',
        description: 'Maximum number of lines to read (optional)'
      },
      offset: {
        type: 'number',
        description: 'Line offset to start reading from (default: 0)'
      }
    },
    required: ['path']
  },
  handler: async (params, context) => {
    const { path, encoding = 'utf-8', maxLines, offset = 0 } = params;
    
    if (!isPathAllowed(path, context.environment.ALLOWED_PATHS)) {
      return { success: false, error: 'Path not allowed' };
    }
    
    try {
      const content = await readFile(path, encoding, maxLines, offset);
      return { success: true, output: content };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
};
```

**文件写入工具**：

```typescript
// src/tools/builtins/file-write.ts
export const fileWriteTool: ToolDefinition = {
  name: 'file_write',
  description: 'Write content to a file in the local filesystem',
  category: 'filesystem',
  tags: ['file', 'write', 'io'],
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The absolute path to the file to write'
      },
      content: {
        type: 'string',
        description: 'The content to write to the file'
      },
      createDirectories: {
        type: 'boolean',
        description: 'Create parent directories if they do not exist',
        default: true
      },
      backup: {
        type: 'boolean',
        description: 'Create a backup of existing file before writing',
        default: false
      }
    },
    required: ['path', 'content']
  },
  handler: async (params, context) => {
    const { path, content, createDirectories = true, backup = false } = params;
    
    if (!isPathAllowed(path, context.environment.ALLOWED_PATHS)) {
      return { success: false, error: 'Path not allowed' };
    }
    
    try {
      if (backup && await fileExists(path)) {
        await createBackup(path);
      }
      
      if (createDirectories) {
        await ensureDirectoryExists(dirname(path));
      }
      
      await writeFile(path, content);
      return { success: true, output: `File written successfully: ${path}` };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
};
```

**Shell执行工具**：

```typescript
// src/tools/builtins/shell.ts
export const shellTool: ToolDefinition = {
  name: 'shell',
  description: 'Execute shell commands in the terminal',
  category: 'system',
  tags: ['shell', 'command', 'exec'],
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The shell command to execute'
      },
      timeout: {
        type: 'number',
        description: 'Maximum execution time in milliseconds',
        default: 30000
      },
      cwd: {
        type: 'string',
        description: 'Working directory for command execution'
      }
    },
    required: ['command']
  },
  handler: async (params, context) => {
    const { command, timeout = 30000, cwd } = params;
    
    if (isDangerousCommand(command)) {
      return { success: false, error: 'Command blocked for security reasons' };
    }
    
    try {
      const result = await execCommand(command, {
        timeout,
        cwd: cwd || context.workingDirectory,
        env: context.environment
      });
      
      return {
        success: result.exitCode === 0,
        output: result.stdout,
        error: result.stderr,
        metadata: { exitCode: result.exitCode }
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
};

function isDangerousCommand(command: string): boolean {
  const dangerousPatterns = [
    /^rm\s+-rf\s+\//,
    /^dd\s+/,
    /^mkfs\s+/,
    /^format\s+/,
    /^>:*/,
    /^curl\s+.*\|.*sh/,
    /^wget\s+.*\|.*sh/
  ];
  
  return dangerousPatterns.some(pattern => pattern.test(command));
}
```

**HTTP请求工具**：

```typescript
// src/tools/builtins/http.ts
export const httpTool: ToolDefinition = {
  name: 'http_request',
  description: 'Send HTTP requests to external APIs',
  category: 'network',
  tags: ['http', 'request', 'api'],
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to send the request to'
      },
      method: {
        type: 'string',
        description: 'HTTP method',
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        default: 'GET'
      },
      headers: {
        type: 'object',
        description: 'HTTP headers'
      },
      body: {
        type: 'string',
        description: 'Request body (for POST/PUT/PATCH)'
      },
      timeout: {
        type: 'number',
        description: 'Request timeout in milliseconds',
        default: 30000
      }
    },
    required: ['url']
  },
  handler: async (params) => {
    const { url, method = 'GET', headers = {}, body, timeout = 30000 } = params;
    
    try {
      const response = await axios({
        method,
        url,
        headers,
        data: body,
        timeout,
        validateStatus: () => true
      });
      
      return {
        success: true,
        output: JSON.stringify({
          status: response.status,
          headers: response.headers,
          body: response.data
        }, null, 2)
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
};
```

### ２.４　上下文与会话管理

**上下文管理器**负责维护Agent执行过程中的状态信息。这包括当前对话的历史消息、工具调用的结果、以及各种临时状态。上下文管理器需要支持截断机制，当历史过长时保留最近的对话和最重要的上下文。

**会话管理器**负责管理系统中的所有会话。这包括创建新会话、恢复已有会话、清理过期会话、以及会话数据的持久化。

#### 会话管理实现

```typescript
// src/agent/session/manager.ts
interface Session {
  id: string;
  userId: string;
  channel: string;
  messages: Message[];
  context: Record<string, unknown>;
  createdAt: Date;
  lastActiveAt: Date;
  metadata: SessionMetadata;
}

interface SessionMetadata {
  agentIdentity?: IdentityConfig;
  userPreferences?: UserPreferences;
  systemPrompt?: string;
  toolContext?: Record<string, unknown>;
}

class SessionManager {
  private sessions: Map<string, Session>;
  private maxHistoryLength: number;
  
  async createSession(userId: string, channel: string): Promise<Session> {
    const session: Session = {
      id: generateSessionId(),
      userId,
      channel,
      messages: [],
      context: {},
      createdAt: new Date(),
      lastActiveAt: new Date(),
      metadata: {}
    };
    
    this.sessions.set(session.id, session);
    await this.persistSession(session);
    return session;
  }
  
  async addMessage(sessionId: string, message: Message): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    
    session.messages.push(message);
    session.lastActiveAt = new Date();
    
    if (session.messages.length > this.maxHistoryLength) {
      session.messages = this.truncateHistory(session.messages);
    }
    
    await this.persistSession(session);
  }
  
  private truncateHistory(messages: Message[]): Message[] {
    const keepRecent = Math.floor(this.maxHistoryLength * 0.7);
    const keepImportant = Math.floor(this.maxHistoryLength * 0.3);
    
    const recent = messages.slice(-keepRecent);
    const important = messages.filter(m => m.isImportant).slice(-keepImportant);
    
    return [...important, ...recent].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }
}
```

---

## 三、模块接口定义

### ３.１　Gateway与Agent Runtime的接口

```typescript
// src/agent/runtime.interface.ts
interface AgentRuntime {
  processMessage(sessionId: string, message: Message): Promise<Response>;
  getSessionState(sessionId: string): Promise<SessionState>;
  abortSession(sessionId: string): Promise<void>;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

interface Response {
  message: string;
  type: 'final' | 'partial' | 'tool_call';
  toolCalls?: ToolCall[];
  metadata?: Record<string, unknown>;
}

interface SessionState {
  sessionId: string;
  status: 'active' | 'processing' | 'idle';
  messageCount: number;
  lastMessage?: Date;
}
```

### ３.２　Agent Runtime与工具系统的接口

```typescript
// src/tools/registry.interface.ts
interface ToolRegistry {
  registerTool(tool: ToolDefinition): void;
  unregisterTool(name: string): boolean;
  getTool(name: string): ToolDefinition | undefined;
  listTools(filter?: ToolFilter): ToolDefinition[];
  executeTool(name: string, params: Record<string, unknown>): Promise<ToolResult>;
}

interface ToolFilter {
  category?: string;
  tags?: string[];
  searchText?: string;
}
```

### ３.３　模型调用接口

```typescript
// src/agent/model/interface.ts
interface ModelCaller {
  call(prompt: ModelPrompt): Promise<ModelResponse>;
  callStream(prompt: ModelPrompt, onChunk: (chunk: string) => void): Promise<void>;
}

interface ModelPrompt {
  system: string;
  messages: Message[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
}

interface ModelResponse {
  content: string;
  toolCalls?: ToolCall[];
  finishReason: 'stop' | 'length' | 'tool_calls' | 'error';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

---

## 四、验收标准

任务流甲完成后，应满足以下验收标准：

Gateway能够成功启动和停止，支持前台运行和守护进程模式，能够处理各种错误情况而不崩溃。

Agent Runtime能够接收用户消息，生成符合预期的Prompt，并正确解析LLM的响应。

ReAct循环能够正确处理单轮对话和多轮对话，能够识别并执行工具调用，能够正确终止循环。

工具调用系统能够注册和调用各种工具，能够验证参数和处理错误，能够实现超时控制。

系统能够与至少一个主流LLM API进行交互，能够处理网络错误和API错误。

---

## 五、代码规范

### ５.１　项目结构

```
src/
├── gateway/           # Gateway主进程
│   ├── index.ts       # 入口文件
│   ├── gateway.ts     # Gateway类
│   ├── config/        # 配置管理
│   │   ├── loader.ts
│   │   └── types.ts
│   ├── services/      # 服务组件
│   └── utils/         # 工具函数
│       ├── logger.ts
│       └── errors.ts
├── agent/             # Agent Runtime
│   ├── runtime.ts     # 运行时核心
│   ├── react/         # ReAct实现
│   │   ├── engine.ts
│   │   └── types.ts
│   ├── prompt/        # Prompt构建
│   │   └── builder.ts
│   ├── model/         # 模型交互
│   │   ├── caller.ts
│   │   └── adapters/
│   ├── session/       # 会话管理
│   │   └── manager.ts
│   └── memory/        # 记忆系统接口
└── tools/             # 工具系统
    ├── registry.ts
    ├── executor.ts
    ├── types.ts
    └── builtins/      # 内置工具
        ├── file-read.ts
        ├── file-write.ts
        ├── shell.ts
        └── http.ts
```

### ５.２　命名规范

| 类型 | 规范 | 示例 |
|-----|------|------|
| 文件名 | kebab-case | message-handler.ts |
| 类名 | PascalCase | MessageHandler |
| 接口名 | PascalCase | ToolDefinition |
| 函数名 | camelCase | processMessage |
| 常量名 | UPPER_SNAKE_CASE | MAX_TOKEN_LIMIT |
| 类型成员 | PascalCase | ExitCode |

### ５.３　错误处理

```typescript
// 所有自定义错误应继承此类
export class OpenClawError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'OpenClawError';
  }
}

export class ToolExecutionError extends OpenClawError {
  constructor(toolName: string, cause: Error) {
    super(
      `Tool execution failed: ${toolName}`,
      'TOOL_EXECUTION_ERROR',
      { toolName, cause: cause.message }
    );
    this.name = 'ToolExecutionError';
  }
}

export class SessionNotFoundError extends OpenClawError {
  constructor(sessionId: string) {
    super(
      `Session not found: ${sessionId}`,
      'SESSION_NOT_FOUND',
      { sessionId }
    );
    this.name = 'SessionNotFoundError';
  }
}
```

---

## 六、协作说明

### ６.１　与任务流乙的接口对接

任务流甲负责定义的接口，任务流乙会依赖这些接口进行开发：

**Agent Runtime接口**：由任务流甲实现，任务流乙通过Channel Adapter调用。

**工具注册表接口**：由任务流甲实现，任务流乙的Skills系统需要将自己包含的工具注册到这个表中。

**会话管理器接口**：任务流甲和任务流乙都会使用，用于消息的会话关联。

### ６.２　开发顺序建议

建议按以下顺序开发：

第一阶段：Gateway主进程框架（1天）

- 实现进程管理、配置加载、HTTP/WebSocket服务

第二阶段：Agent Runtime基础（2天）

- 实现Prompt构建、模型调用接口、基本的ReAct循环

第三阶段：工具调用系统（2天）

- 实现工具注册表、四种内置工具

第四阶段：会话管理（1天）

- 实现会话管理器、上下文管理

第五阶段：集成与优化（1-2天）

- 与任务流乙进行集成测试
- 修复接口对接问题
- 优化性能和稳定性

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

完成Gateway主进程框架搭建，实现基本的HTTP/WebSocket服务。

交付物：可运行的基础框架，能够响应HTTP请求。

### 里程碑二：核心功能实现（3-5天）

完成Agent Runtime实现，包括Prompt构建、ReAct循环、LLM调用、基础工具。

交付物：能够处理用户消息并执行简单工具调用的完整Agent核心。

### 里程碑三：功能完善与集成（2-3天）

完善工具系统，增加更多内置工具，优化错误处理。

交付物：功能完善的运行时系统，可与任务流乙成果集成。
