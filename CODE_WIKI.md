# OpenClaw Minimal — Code Wiki

> **项目名称**: openclaw-minimal  
> **版本**: 0.1.0  
> **许可证**: MIT  
> **语言**: TypeScript (ES2022, strict mode)  
> **运行时**: Node.js >= 22.0.0  
> **模块系统**: NodeNext (ESM + .js 扩展名导入)

---

## 目录

1. [项目概述](#1-项目概述)
2. [整体架构](#2-整体架构)
3. [目录结构](#3-目录结构)
4. [核心模块详解](#4-核心模块详解)
   - 4.1 [Agent 运行时 (src/agent)](#41-agent-运行时-srcagent)
   - 4.2 [渠道适配器 (src/channels)](#42-渠道适配器-srcchannels)
   - 4.3 [工具系统 (src/tools)](#43-工具系统-srctools)
   - 4.4 [配置系统 (src/config)](#44-配置系统-srcconfig)
   - 4.5 [心跳调度 (src/heartbeat)](#45-心跳调度-srcheartbeat)
   - 4.6 [网关 (src/gateway)](#46-网关-srcgateway)
   - 4.7 [类型定义 (src/types)](#47-类型定义-srctypes)
   - 4.8 [工具函数 (src/utils)](#48-工具函数-srcutils)
5. [技能系统 (skills)](#5-技能系统-skills)
6. [配置文件 (config)](#6-配置文件-config)
7. [示例应用 (examples)](#7-示例应用-examples)
8. [依赖关系图](#8-依赖关系图)
9. [数据流与交互逻辑](#9-数据流与交互逻辑)
10. [项目运行方式](#10-项目运行方式)
11. [测试体系](#11-测试体系)
12. [安全机制](#12-安全机制)
13. [错误体系](#13-错误体系)

---

## 1. 项目概述

OpenClaw Minimal 是一个**本地优先 (local-first)** 的 AI Agent 框架，使用 TypeScript 构建。它采用 **ReAct（推理 + 行动）模式**，让 AI 能够自主调用工具、执行任务，并通过多渠道与用户交互。

### 核心特性

| 特性 | 说明 |
|------|------|
| ReAct 引擎 | 内置推理-行动-观察循环，AI 可自主决策并调用工具 |
| 多渠道接入 | 支持 Telegram、TUI（终端界面），可扩展接入其他即时通讯平台 |
| 技能系统 | 基于 YAML 配置的动态技能加载，支持关键字/正则触发 |
| 内置工具 | 文件读写、HTTP 请求、Shell 命令执行（含安全防护） |
| 定时任务 | 基于 Cron 表达式的心跳调度系统 |
| Markdown 配置 | 用 Markdown 文件定义 AI 的灵魂、身份和用户偏好 |
| 会话管理 | 带持久化的会话状态管理，支持消息历史截断 |
| Gateway 网关 | 提供 HTTP API 和 WebSocket 接口，便于外部集成 |

---

## 2. 整体架构

```
┌──────────────────────────────────────────────────────────────┐
│                     Gateway 网关层                            │
│               (HTTP / WebSocket 接口)                         │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Gateway                                                 │ │
│  │  - HTTP 路由 (/health, /sessions/:id, /v1/messages)     │ │
│  │  - WebSocket 消息处理                                    │ │
│  │  - 组件编排与生命周期管理                                  │ │
│  └──────────────────────────┬──────────────────────────────┘ │
└─────────────────────────────┼────────────────────────────────┘
                              │
        ┌─────────────────────┼──────────────────────┐
        │                     │                      │
        ▼                     ▼                      ▼
┌───────────────┐   ┌─────────────────┐   ┌──────────────────┐
│   Channel     │   │     Agent       │   │     Skills       │
│   渠道适配器   │   │     运行时      │   │     技能平台      │
│ ┌───────────┐ │   │ ┌─────────────┐│   │  ┌────────────┐  │
│ │ Telegram  │ │   │ │ ReactEngine ││   │  │ weather    │  │
│ │ Adapter   │ │   │ │ (ReAct循环) ││   │  │ reminder   │  │
│ ├───────────┤ │   │ ├─────────────┤│   │  │ web-search │  │
│ │ TUI       │ │   │ │ ModelCaller ││   │  └────────────┘  │
│ │ Adapter   │ │   │ │ (OpenAI兼容)││   │                  │
│ └───────────┘ │   │ ├─────────────┤│   │  SkillsLoader    │
│               │   │ │PromptBuilder││   │  动态加载技能     │
│ ChannelRouter │   │ ├─────────────┤│   │  触发器匹配       │
│ 消息路由       │   │ │SessionMgr   ││   └────────┬─────────┘
└───────┬───────┘   │ └─────────────┘│           │
        │           └────────┬────────┘           │
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
           ┌─────────────────┼──────────────────┐
           ▼                 ▼                  ▼
    ┌────────────┐   ┌──────────────┐   ┌──────────────┐
    │   Config   │   │    Tool      │   │  Heartbeat   │
    │   配置解析  │   │    工具注册   │   │  定时调度     │
    │ ConfigParser│   │ ToolRegistry │   │ CronParser   │
    │ loadConfig  │   │ Builtins:    │   │ Scheduler    │
    │             │   │  file_read   │   │              │
    │ SOUL.md     │   │  file_write  │   │ HEARTBEAT.md │
    │ IDENTITY.md │   │  http_request│   │              │
    │ USER.md     │   │  shell       │   │              │
    └────────────┘   └──────────────┘   └──────────────┘
```

### 架构分层说明

| 层级 | 职责 | 关键模块 |
|------|------|----------|
| **网关层** | 对外暴露 HTTP/WS 接口，编排所有组件 | `Gateway` |
| **渠道层** | 接入不同消息平台，统一消息格式 | `BaseChannelAdapter`, `ChannelRouterImpl` |
| **Agent 层** | ReAct 推理循环，LLM 调用，会话管理 | `ReactEngine`, `AgentRuntimeImpl` |
| **工具层** | 工具注册与执行，技能动态加载 | `ToolRegistry`, `SkillsLoader` |
| **基础设施层** | 配置解析、定时调度、日志、错误处理 | `ConfigParser`, `HeartbeatScheduler` |

---

## 3. 目录结构

```
openclaw-minimal/
├── src/                          # 源代码根目录
│   ├── agent/                    # Agent 运行时
│   │   ├── model/                # LLM 模型调用
│   │   │   ├── interface.ts      # ModelCaller 接口定义
│   │   │   └── caller.ts         # OpenAI 兼容 API 调用实现
│   │   ├── prompt/               # 提示词构建
│   │   │   └── builder.ts        # PromptBuilder 系统提示词构建器
│   │   ├── react/                # ReAct 引擎核心
│   │   │   ├── engine.ts         # ReactEngine 推理-行动循环
│   │   │   └── types.ts          # ReactState, ReactContext, ThinkDecision
│   │   ├── session/              # 会话管理
│   │   │   ├── manager.ts        # SessionManager 会话生命周期
│   │   │   └── types.ts          # 类型重导出
│   │   ├── runtime.ts            # AgentRuntimeImpl 实现
│   │   └── runtime.interface.ts  # AgentRuntime 接口
│   ├── channels/                 # 渠道适配器
│   │   ├── telegram/             # Telegram 适配器
│   │   │   └── adapter.ts        # TelegramAdapter
│   │   ├── tui/                  # TUI 终端适配器
│   │   │   ├── adapter.ts        # TuiAdapter
│   │   │   ├── index.ts          # 导出
│   │   │   └── types.ts          # TuiConfig 接口
│   │   ├── adapter.ts            # BaseChannelAdapter 抽象基类
│   │   ├── router.ts             # ChannelRouterImpl 消息路由
│   │   ├── types.ts              # MessageHandler, ChannelRouter 接口
│   │   └── index.ts              # 导出
│   ├── config/                   # 配置解析
│   │   ├── parser.ts             # ConfigParser Markdown 配置解析
│   │   ├── loader.ts             # loadConfig Gateway 配置加载
│   │   └── index.ts              # 导出
│   ├── gateway/                  # HTTP/WS 网关
│   │   ├── gateway.ts            # Gateway 主类
│   │   └── index.ts              # 入口 main()
│   ├── heartbeat/                # 定时调度
│   │   ├── cron.ts               # CronParser Cron 表达式解析
│   │   ├── scheduler.ts          # HeartbeatScheduler 任务调度器
│   │   └── index.ts              # 导出
│   ├── tools/                    # 工具系统
│   │   ├── builtins/             # 内置工具
│   │   │   ├── file-read.ts      # file_read 文件读取
│   │   │   ├── file-write.ts     # file_write 文件写入
│   │   │   ├── http.ts           # http_request HTTP 请求
│   │   │   ├── shell.ts          # shell 命令执行
│   │   │   ├── path-policy.ts    # 路径白名单策略
│   │   │   └── index.ts          # registerBuiltInTools
│   │   ├── registry.ts           # ToolRegistry 工具注册表
│   │   ├── skills-loader.ts      # SkillsLoader 技能加载器
│   │   └── index.ts              # 导出
│   ├── types/                    # TypeScript 类型定义
│   │   ├── config.ts             # 配置相关类型
│   │   ├── message.ts            # 消息相关类型
│   │   ├── tool.ts               # 工具相关类型
│   │   ├── skill.ts              # 技能相关类型
│   │   ├── session.ts            # 会话相关类型
│   │   ├── heartbeat.ts          # 心跳任务类型
│   │   └── index.ts              # 统一导出
│   ├── utils/                    # 工具函数
│   │   ├── errors.ts             # 错误类层次
│   │   ├── id.ts                 # randomId, filterEnvVars
│   │   ├── logger.ts             # Logger 单例日志
│   │   └── index.ts              # 导出
│   ├── __tests__/                # 测试文件
│   │   ├── cron.test.ts
│   │   ├── prompt.test.ts
│   │   ├── tools.test.ts
│   │   ├── tui.test.ts
│   │   └── utils.test.ts
│   └── index.ts                  # 包入口导出
├── config/                       # Markdown 配置文件
│   ├── SOUL.md                   # AI 灵魂/价值观
│   ├── IDENTITY.md               # AI 身份/性格
│   ├── USER.md                   # 用户偏好
│   └── HEARTBEAT.md              # 定时任务
├── skills/                       # 技能目录
│   ├── weather/                  # 天气查询技能
│   ├── reminder/                 # 提醒技能
│   └── web-search/               # 网页搜索技能
├── examples/                     # 示例应用
│   ├── simple-app.ts             # 完整示例（含 Telegram）
│   ├── standalone-demo.ts        # 独立演示（无需 API 密钥）
│   └── tui-app.ts                # TUI 终端界面示例
├── docs/                         # 文档
├── jest.config.ts                # Jest 测试配置
├── tsconfig.json                 # TypeScript 编译配置
├── package.json                  # 项目元数据与依赖
└── rebuild.ps1                   # PowerShell 重新编译脚本
```

---

## 4. 核心模块详解

### 4.1 Agent 运行时 (`src/agent`)

Agent 运行时是整个框架的核心，负责 ReAct 推理循环、LLM 调用、提示词构建和会话管理。

#### 4.1.1 `AgentRuntime` 接口

**文件**: [runtime.interface.ts](file:///workspace/src/agent/runtime.interface.ts)

```typescript
interface AgentRuntime {
  processMessage(sessionId: string, message: Message): Promise<AgentResponse>;
  getSessionState(sessionId: string): Promise<SessionState>;
  abortSession(sessionId: string): Promise<void>;
}
```

| 方法 | 说明 |
|------|------|
| `processMessage` | 处理用户消息，执行 ReAct 循环，返回 Agent 响应 |
| `getSessionState` | 获取指定会话的当前状态 |
| `abortSession` | 中止指定会话 |

#### 4.1.2 `AgentRuntimeImpl` 实现

**文件**: [runtime.ts](file:///workspace/src/agent/runtime.ts)

`AgentRuntimeImpl` 是 `AgentRuntime` 接口的唯一实现，作为 Agent 运行时的入口。

**构造参数** (`AgentRuntimeOptions`):

| 参数 | 类型 | 说明 |
|------|------|------|
| `sessionManager` | `SessionManager` | 会话管理器 |
| `toolRegistry` | `ToolRegistryContract` | 工具注册表 |
| `modelCaller` | `ModelCaller` | LLM 模型调用器 |
| `config` | `GatewayConfig` | 网关配置 |
| `engineConfig` | `ReactEngineConfig?` | ReAct 引擎配置（灵魂/身份/用户偏好） |

**核心流程** (`processMessage`):

1. 获取或创建会话
2. 设置会话状态为 `processing`
3. 将用户消息添加到会话历史
4. 构建 `ReactContext`，包含消息历史、工具列表、最大迭代次数等
5. 调用 `ReactEngine.run()` 执行 ReAct 循环
6. 将引擎元数据合并到最后一条助手消息
7. 替换会话消息历史
8. 设置会话状态为 `idle`
9. 返回 `AgentResponse`

#### 4.1.3 `ReactEngine` — ReAct 推理引擎

**文件**: [react/engine.ts](file:///workspace/src/agent/react/engine.ts)

这是框架的核心推理引擎，实现了 **Think → Act → Observe** 的 ReAct 循环。

**ReAct 状态机** (`ReactState`):

```
THINKING → ACTING → OBSERVING → THINKING → ... → FINISHED
                                                    FAILED
```

| 状态 | 说明 |
|------|------|
| `THINKING` | 调用 LLM 进行推理，决定是直接回复还是调用工具 |
| `ACTING` | 执行工具调用 |
| `OBSERVING` | 将工具结果格式化并加入消息历史 |
| `FINISHED` | LLM 产生了最终回复 |
| `FAILED` | 达到最大迭代次数仍未产生最终回复 |

**核心方法**:

| 方法 | 说明 |
|------|------|
| `run(context)` | 执行 ReAct 主循环，返回 `AgentResponse` |
| `think(context)` | 调用 LLM 推理，返回 `ThinkDecision` |
| `act(context, toolCalls)` | 并行执行所有工具调用 |
| `formatToolResults(results)` | 将工具结果格式化为 `Message[]` |
| `buildSystemPrompt(tools)` | 构建系统提示词 |
| `parseThinkResponse(response)` | 解析 LLM 响应，判断是否需要调用工具 |

**ReAct 循环流程**:

```
1. while (state != FINISHED && state != FAILED && iteration < maxIterations)
2.   state = THINKING
3.   decision = think(context)           // 调用 LLM
4.   if decision.shouldRespond:
5.     return final response             // LLM 决定直接回复
6.   state = ACTING
7.   results = act(context, toolCalls)   // 并行执行工具
8.   state = OBSERVING
9.   messages.push(toolResults)          // 观察工具结果
10.  iteration++
11. return FAILED (达到最大迭代次数)
```

#### 4.1.4 `ModelCaller` — LLM 模型调用

**接口**: [interface.ts](file:///workspace/src/agent/model/interface.ts)

```typescript
interface ModelCaller {
  call(prompt: ModelPrompt): Promise<ModelResponse>;
  callStream(prompt: ModelPrompt, onChunk: (chunk: string) => void): Promise<void>;
}
```

**实现**: [caller.ts](file:///workspace/src/agent/model/caller.ts) — `OpenAICompatibleModelCaller`

- 兼容 OpenAI API 格式（支持 DeepSeek 等）
- 调用超时: 120 秒
- 支持 DeepSeek thinking-mode 的 `reasoning_content` 字段
- 支持 tool_calls 功能调用
- `callStream` 目前为 stub 实现，回退到非流式调用

**`ModelPrompt` 结构**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `system` | `string` | 系统提示词 |
| `messages` | `Message[]` | 对话历史 |
| `tools` | `ToolDefinition[]?` | 可用工具定义 |
| `temperature` | `number?` | 温度参数 |
| `maxTokens` | `number?` | 最大 token 数 |

**`ModelResponse` 结构**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `content` | `string` | 模型输出文本 |
| `reasoningContent` | `string?` | DeepSeek 思维链内容 |
| `toolCalls` | `ToolCall[]?` | 工具调用请求 |
| `finishReason` | `'stop' \| 'length' \| 'tool_calls' \| 'error'` | 结束原因 |
| `usage` | `{promptTokens, completionTokens, totalTokens}?` | Token 用量 |

#### 4.1.5 `PromptBuilder` — 提示词构建器

**文件**: [builder.ts](file:///workspace/src/agent/prompt/builder.ts)

| 方法 | 说明 |
|------|------|
| `buildSystemPrompt(tools)` | 构建默认系统提示词（含工具列表） |
| `buildSystemPromptFromConfig(soul, identity, user, tools)` | 从 Markdown 配置构建个性化系统提示词 |
| `buildMessages(messages)` | 构建消息列表，自动截断超长内容（>12000 字符） |
| `setSystemPromptOverride(prompt)` | 设置系统提示词覆盖 |

**提示词结构**（从配置构建时）:

```
# Identity — 你是 {name}
## Background — {background}
## Personality — {personology}
## Traits — {traits}
# Core Values — {values}
## Behavior Guidelines — {behavior}
## Rules — {guidelines}
# User Context — 用户名、语言、时区
# Available tools — 工具列表
# Instructions — 使用规则
```

#### 4.1.6 `SessionManager` — 会话管理器

**文件**: [manager.ts](file:///workspace/src/agent/session/manager.ts)

负责会话的创建、持久化、消息管理和历史截断。

**核心方法**:

| 方法 | 说明 |
|------|------|
| `getOrCreateSession(sessionId, userId, channel)` | 获取或创建会话（带锁） |
| `createSession(userId, channel)` | 创建新会话（自动生成 ID） |
| `addMessage(sessionId, message)` | 添加消息到会话 |
| `replaceMessages(sessionId, messages)` | 替换会话全部消息 |
| `setStatus(sessionId, status)` | 设置会话状态 |
| `getState(sessionId)` | 获取会话状态摘要 |

**并发控制**: 使用 `withLock` 实现基于 Promise 链的简单互斥锁，确保同一会话的操作串行执行。

**消息历史截断策略** (`truncateHistory`):

- 当消息数超过 `maxHistoryLength` 时触发
- 保留最近 70% 的消息
- 保留标记为 `isImportant` 的早期消息（最多 30%）
- 最终按时间戳排序

**持久化**: 会话以 JSON 文件存储在 `config.memory.storagePath` 目录下，文件名为 `{sessionId}.json`。

---

### 4.2 渠道适配器 (`src/channels`)

渠道适配器负责接入不同的消息平台，将平台特定的消息格式统一为 `NormalizedMessage`。

#### 4.2.1 `BaseChannelAdapter` — 抽象基类

**文件**: [adapter.ts](file:///workspace/src/channels/adapter.ts)

继承自 `EventEmitter`，定义了渠道适配器的通用生命周期和消息处理流程。

**抽象方法**（子类必须实现）:

| 方法 | 说明 |
|------|------|
| `validateConfig()` | 验证配置有效性 |
| `setupConnection()` | 建立连接 |
| `startListening()` | 开始监听消息 |
| `stopListening()` | 停止监听 |
| `send(destination, message)` | 发送消息 |
| `formatMessage(message)` | 格式化消息 |
| `extractSender(payload)` | 从原始消息提取发送者 |
| `extractRecipient(payload)` | 从原始消息提取接收者 |
| `extractContent(payload)` | 从原始消息提取内容 |
| `extractAttachments(payload)` | 从原始消息提取附件 |
| `extractMetadata(payload)` | 从原始消息提取元数据 |

**生命周期**: `init()` → `startListening()` → 运行中 → `stopListening()` → `stop()`

**自动重连**: 当发生可重试错误（ECONNRESET、ETIMEDOUT 等）且未禁用自动重连时，会按配置的延迟时间自动重连。

**消息标准化**: `normalizeIncoming(payload)` 方法将平台特定的原始消息转换为 `NormalizedMessage`，流程为:

```
原始消息 → extractSender → extractRecipient → extractContent → extractAttachments → extractMetadata → NormalizedMessage
```

#### 4.2.2 `TuiAdapter` — 终端界面适配器

**文件**: [tui/adapter.ts](file:///workspace/src/channels/tui/adapter.ts)

基于 Node.js `readline` 模块的终端聊天界面。

- **channelName**: `'tui'`
- **支持内容类型**: 仅 `text`
- **内置命令**: `/quit`, `/exit`, `/clear`, `/help`, `/status`
- **ANSI 彩色输出**: 自动检测 TTY，支持开关
- **时间戳显示**: 可配置

**`TuiConfig` 配置项**:

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `prompt` | `string` | `'> '` | 输入提示符 |
| `sessionId` | `string` | `'tui-local'` | 会话 ID |
| `userId` | `string` | `'local-user'` | 用户标识 |
| `userName` | `string` | `'Local User'` | 用户显示名称 |
| `colorEnabled` | `boolean?` | 自动检测 | 是否启用 ANSI 彩色输出 |
| `showTimestamp` | `boolean` | `false` | 是否显示时间戳 |

#### 4.2.3 `TelegramAdapter` — Telegram 适配器

**文件**: [telegram/adapter.ts](file:///workspace/src/channels/telegram/adapter.ts)

接入 Telegram Bot API，支持长轮询和 Webhook 两种模式。

- **channelName**: `'telegram'`
- **支持内容类型**: `text`, `image`, `audio`, `video`, `file`, `location`
- **消息发送**: 支持 MarkdownV2 格式，解析失败自动降级为纯文本
- **内联键盘**: 支持 `inline` 和 `reply` 两种回复标记

**`TelegramConfig` 配置项**:

| 选项 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `botToken` | `string` | 是 | Telegram Bot Token |
| `webhookSecret` | `string?` | 否 | Webhook 密钥 |
| `pollingInterval` | `number?` | 否 | 轮询间隔（默认 1000ms） |
| `useWebhook` | `boolean?` | 否 | 是否使用 Webhook 模式 |
| `webhookUrl` | `string?` | 否 | Webhook URL |

#### 4.2.4 `ChannelRouterImpl` — 消息路由器

**文件**: [router.ts](file:///workspace/src/channels/router.ts)

管理多个渠道适配器，负责消息路由和会话映射。

**核心方法**:

| 方法 | 说明 |
|------|------|
| `registerAdapter(adapter)` | 注册渠道适配器，监听其 `message` 和 `error` 事件 |
| `unregisterAdapter(channelName)` | 注销渠道适配器 |
| `routeMessage(message)` | 路由消息到 `MessageHandler.onMessage` |
| `startAll()` | 启动所有已注册的适配器 |
| `stopAll()` | 停止所有已注册的适配器 |
| `cleanInactiveSessions(maxInactiveMs)` | 清理不活跃的会话映射 |

**会话映射**: 使用 `channel:senderId` 作为索引键，为每个渠道-用户组合映射唯一的 sessionId。

---

### 4.3 工具系统 (`src/tools`)

工具系统是 Agent 与外部世界交互的桥梁，包含工具注册表、内置工具和技能加载器。

#### 4.3.1 `ToolRegistry` — 工具注册表

**文件**: [registry.ts](file:///workspace/src/tools/registry.ts)

实现 `ToolRegistryContract` 接口，管理工具的注册、查找和执行。

**核心方法**:

| 方法 | 说明 |
|------|------|
| `registerTool(tool)` | 注册工具（按 category 和 tags 索引） |
| `unregisterTool(name)` | 注销工具 |
| `getTool(name)` | 按名称获取工具定义 |
| `hasTool(name)` | 检查工具是否存在 |
| `listTools(filter?)` | 列出工具（支持按 category/tags/searchText 过滤） |
| `executeTool(name, params, context?)` | 执行工具（含参数校验和超时控制） |

**工具执行流程**:

```
1. 查找工具定义
2. 校验必需参数
3. 校验参数类型
4. 构建 ToolExecutionContext（注入安全策略）
5. 带超时执行 handler
6. 返回 ToolResult
```

**默认安全配置**:

| 配置项 | 默认值 |
|--------|--------|
| `timeout` | 30000ms |
| `allowedPaths` | `['./workspace']` |
| `blockedCommands` | `['rm -rf /', 'dd', 'mkfs', 'format', 'shutdown', 'curl\|sh', 'wget\|sh']` |

#### 4.3.2 内置工具

**文件**: `src/tools/builtins/`

| 工具名 | 文件 | 分类 | 说明 | 安全限制 |
|--------|------|------|------|----------|
| `file_read` | [file-read.ts](file:///workspace/src/tools/builtins/file-read.ts) | filesystem | 读取本地文件 | 路径白名单 |
| `file_write` | [file-write.ts](file:///workspace/src/tools/builtins/file-write.ts) | filesystem | 写入本地文件 | 路径白名单，支持备份 |
| `http_request` | [http.ts](file:///workspace/src/tools/builtins/http.ts) | network | 发送 HTTP 请求 | SSRF 防护 |
| `shell` | [shell.ts](file:///workspace/src/tools/builtins/shell.ts) | system | 执行 Shell 命令 | 危险命令拦截 + 路径白名单 |

**`file_read` 参数**:

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `path` | `string` | 是 | 文件路径 |
| `encoding` | `string` | 否 | 编码（默认 utf-8） |
| `maxLines` | `number` | 否 | 最大行数 |
| `offset` | `number` | 否 | 起始行偏移 |

**`file_write` 参数**:

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `path` | `string` | 是 | 文件路径 |
| `content` | `string` | 是 | 写入内容 |
| `createDirectories` | `boolean` | 否 | 是否创建父目录（默认 true） |
| `backup` | `boolean` | 否 | 是否创建备份（默认 false） |

**`http_request` 参数**:

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `url` | `string` | 是 | 请求 URL |
| `method` | `string` | 否 | HTTP 方法（默认 GET） |
| `headers` | `object` | 否 | 请求头 |
| `body` | `string` | 否 | 请求体 |
| `timeout` | `number` | 否 | 超时时间（默认 30000ms） |

**`shell` 参数**:

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `command` | `string` | 是 | Shell 命令 |
| `timeout` | `number` | 否 | 超时时间（默认 30000ms） |
| `cwd` | `string` | 否 | 工作目录 |

#### 4.3.3 `path-policy.ts` — 路径安全策略

**文件**: [path-policy.ts](file:///workspace/src/tools/builtins/path-policy.ts)

`isPathAllowed(path, allowedPathsText)` 函数实现路径白名单检查：

- 将相对路径解析为绝对路径
- 使用 `realpathSync` 解析符号链接
- 检查目标路径是否在任一允许路径下（前缀匹配 + 路径分隔符）

#### 4.3.4 `SkillsLoader` — 技能加载器

**文件**: [skills-loader.ts](file:///workspace/src/tools/skills-loader.ts)

动态加载 `skills/` 目录下的技能模块，将技能工具注册到 `ToolRegistry`。

**核心方法**:

| 方法 | 说明 |
|------|------|
| `loadAll()` | 扫描 skills 目录，加载所有技能 |
| `getSkill(name)` | 获取已加载的技能 |
| `listSkills()` | 列出所有已加载技能的定义 |
| `findMatchingSkills(text)` | 根据文本匹配触发器，返回匹配的技能 |
| `reloadSkill(name)` | 重新加载指定技能 |
| `unloadSkill(name)` | 卸载指定技能 |

**技能加载流程**:

```
1. 扫描 skills/ 下的子目录
2. 读取 skill.yaml 配置
3. 动态 import index.ts 或 index.js
4. 验证模块结构（name + tools）
5. 将技能工具注册到 ToolRegistry（自动添加 skill:{name} 标签）
6. 存入 skills Map
```

**触发器匹配** (`findMatchingSkills`):

| 触发器类型 | 匹配逻辑 |
|-----------|----------|
| `keyword` | 文本中包含任一关键词（不区分大小写） |
| `pattern` | 正则表达式匹配 |

---

### 4.4 配置系统 (`src/config`)

#### 4.4.1 `ConfigParser` — Markdown 配置解析器

**文件**: [parser.ts](file:///workspace/src/config/parser.ts)

解析 `config/` 目录下的 Markdown 配置文件，将人类可读的配置转换为结构化数据。

**核心方法**:

| 方法 | 返回类型 | 说明 |
|------|----------|------|
| `parseSoul()` | `SoulConfig` | 解析 SOUL.md |
| `parseIdentity()` | `IdentityConfig` | 解析 IDENTITY.md |
| `parseUserPreferences()` | `UserPreferences` | 解析 USER.md |
| `parseAll()` | `{soul, identity, user}` | 并行解析所有配置 |

**解析策略**:

- 按 Markdown 标题（`##`）分割为节
- 支持 YAML Front Matter（`---` 包裹）
- 列表项以 `- ` 开头
- 缺失文件时返回默认值

#### 4.4.2 `loadConfig` — Gateway 配置加载

**文件**: [loader.ts](file:///workspace/src/config/loader.ts)

加载 Gateway 运行所需的配置，支持多来源合并。

**配置加载优先级**（从低到高）:

1. **默认配置** (`DEFAULT_CONFIG`)
2. **配置文件** (`config.json` / `config.yaml` / `config.yml`)
3. **环境变量覆盖** (`OPENCLAW_*`)

**环境变量映射**:

| 环境变量 | 配置路径 |
|----------|----------|
| `OPENCLAW_PORT` | `config.port` |
| `OPENCLAW_HOST` | `config.host` |
| `OPENCLAW_LOG_LEVEL` | `config.logLevel` |
| `OPENCLAW_API_KEY` | `config.agent.apiKey` |
| `OPENCLAW_BASE_URL` | `config.agent.baseUrl` |
| `OPENCLAW_MODEL` | `config.agent.model` |
| `OPENCLAW_MAX_ITERATIONS` | `config.agent.maxIterations` |
| `OPENCLAW_CONFIG` | 配置文件路径 |

**配置文件中的环境变量展开**: 支持 `${VAR_NAME}` 语法，在加载时自动替换为环境变量值。

**.env 文件加载**: 自动加载项目根目录的 `.env` 文件，不覆盖已存在的环境变量。

---

### 4.5 心跳调度 (`src/heartbeat`)

#### 4.5.1 `CronParser` — Cron 表达式解析器

**文件**: [cron.ts](file:///workspace/src/heartbeat/cron.ts)

支持标准 5 字段 Cron 表达式解析。

**支持语法**:

| 语法 | 示例 | 说明 |
|------|------|------|
| `*` | `* * * * *` | 每个值 |
| 具体值 | `0 8 * * *` | 每天 8:00 |
| 范围 | `1-5` | 1 到 5 |
| 步长 | `*/15` | 每 15 单位 |
| 列表 | `1,3,5` | 1、3、5 |

**核心方法**:

| 方法 | 说明 |
|------|------|
| `parse(expression)` | 解析 Cron 表达式为 `ParsedCron` |
| `matches(expression, date, timezone?)` | 判断指定时间是否匹配 |
| `getNextRun(expression, timezone?)` | 计算下一次运行时间 |
| `getDescription(expression)` | 生成人类可读的描述 |

**时区支持**: 通过 `Intl.DateTimeFormat` 实现时区感知的日期计算。

#### 4.5.2 `HeartbeatScheduler` — 心跳调度器

**文件**: [scheduler.ts](file:///workspace/src/heartbeat/scheduler.ts)

基于 `CronParser` 的定时任务调度器，每分钟检查一次是否有任务需要执行。

**核心方法**:

| 方法 | 说明 |
|------|------|
| `loadTasks(configPath)` | 从 HEARTBEAT.md 加载任务 |
| `registerTask(taskDef)` | 注册新任务 |
| `start()` | 启动调度器（每分钟检查一次） |
| `stop()` | 停止调度器 |
| `enableTask(taskId)` / `disableTask(taskId)` | 启用/禁用任务 |
| `triggerTask(taskId)` | 手动触发任务 |

**任务执行动作类型**:

| 类型 | 说明 | 执行方式 |
|------|------|----------|
| `skill` | 调用已注册的工具 | `toolRegistry.executeTool()` |
| `notification` | 发送通知消息 | `channelRouter.getAdapter().send()` |
| `command` | 执行 Shell 命令 | `toolRegistry.executeTool('shell', ...)` |

**HEARTBEAT.md 解析**: 按 `###` 标题分割任务块，解析 `schedule`、`timezone`、`enabled` 和动作列表。

**并发控制**: 使用 `runningTasks` Set 防止同一任务并发执行。

---

### 4.6 网关 (`src/gateway`)

#### 4.6.1 `Gateway` — 核心网关

**文件**: [gateway.ts](file:///workspace/src/gateway/gateway.ts)

Gateway 是整个框架的编排中心，负责组件初始化、HTTP/WS 服务和消息处理。

**依赖注入** (`GatewayDeps`):

| 依赖 | 类型 | 说明 |
|------|------|------|
| `config` | `GatewayConfig` | 网关配置 |
| `toolRegistry` | `ToolRegistryContract` | 工具注册表 |
| `sessionManager` | `SessionManager` | 会话管理器 |
| `agentRuntime` | `AgentRuntimeImpl` | Agent 运行时 |
| `channelRouter` | `ChannelRouter` | 渠道路由器 |
| `skillsLoader` | `SkillsLoader` | 技能加载器 |
| `configParser` | `ConfigParser` | 配置解析器 |
| `heartbeatScheduler` | `HeartbeatScheduler` | 心跳调度器 |

**启动流程** (`start`):

```
1. 解析 Markdown 配置 → 设置引擎配置
2. 加载技能 → 注册到工具注册表
3. 加载心跳任务
4. 启动所有渠道适配器
5. 启动心跳调度器
6. 启动 HTTP/WS 服务器
```

**HTTP API**:

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/health` | 健康检查 |
| `GET` | `/sessions/:id` | 获取会话状态 |
| `POST` | `/v1/messages` | 发送消息给 Agent |

**WebSocket**: 连接地址 `ws://localhost:18789`，消息格式与 HTTP API 相同。

#### 4.6.2 `main()` — 入口函数

**文件**: [index.ts](file:///workspace/src/gateway/index.ts)

Gateway 的启动入口，负责创建和组装所有组件：

```
loadConfig() → ConfigParser → ToolRegistry → registerBuiltInTools()
→ SkillsLoader → SessionManager → ChannelRouterImpl → HeartbeatScheduler
→ OpenAICompatibleModelCaller → AgentRuntimeImpl → Gateway
→ gateway.start()
```

---

### 4.7 类型定义 (`src/types`)

**文件**: `src/types/`

| 文件 | 核心类型 | 说明 |
|------|----------|------|
| `config.ts` | `GatewayConfig`, `AgentConfig`, `ToolsConfig`, `MemoryConfig`, `SoulConfig`, `IdentityConfig`, `UserPreferences` | 配置相关 |
| `message.ts` | `Message`, `NormalizedMessage`, `OutboundMessage`, `MessageSender`, `MessageRecipient`, `MessageContent`, `ContentType`, `Attachment`, `ReplyMarkup` | 消息相关 |
| `tool.ts` | `ToolDefinition`, `ToolResult`, `ToolExecutionContext`, `ToolHandler`, `ToolParameterSchema`, `ToolCall`, `ToolFilter` | 工具相关 |
| `skill.ts` | `SkillDefinition`, `SkillModule`, `SkillTrigger`, `LoadedSkill`, `SkillToolDefinition` | 技能相关 |
| `session.ts` | `Session`, `SessionState`, `SessionMetadata`, `AgentResponse` | 会话相关 |
| `heartbeat.ts` | `HeartbeatTask`, `HeartbeatAction`, `ScheduledTask`, `TaskResult` | 心跳相关 |

**核心类型关系图**:

```
Message ────────────────────────────────────────── 消息基础类型
  │
  ├── NormalizedMessage ────────────────────────── 渠道标准化消息
  │     ├── sender: MessageSender
  │     ├── recipient: MessageRecipient
  │     ├── content: MessageContent
  │     └── attachments: Attachment[]
  │
  └── OutboundMessage ──────────────────────────── 出站消息
        ├── content: MessageContent
        └── replyMarkup: ReplyMarkup

ToolDefinition ─────────────────────────────────── 工具定义
  ├── parameters: ToolParameterSchema
  ├── handler: ToolHandler
  └── category / tags

SkillModule ────────────────────────────────────── 技能模块
  └── tools: Record<string, SkillToolDefinition>

Session ────────────────────────────────────────── 会话
  ├── messages: Message[]
  ├── status: 'active' | 'processing' | 'idle' | 'aborted'
  └── metadata: SessionMetadata
```

---

### 4.8 工具函数 (`src/utils`)

#### 4.8.1 `Logger` — 日志系统

**文件**: [logger.ts](file:///workspace/src/utils/logger.ts)

单例模式的日志器，支持 4 个级别：`debug`、`info`、`warn`、`error`。

- 默认级别: `info`
- 输出格式: `[ISO时间戳] [级别] 消息 {JSON上下文}`
- 通过 `logger.setLevel()` 动态调整级别

#### 4.8.2 `randomId` — ID 生成

**文件**: [id.ts](file:///workspace/src/utils/id.ts)

- `randomId()`: 基于 `crypto.randomUUID()` 生成唯一 ID
- `filterEnvVars(env)`: 过滤敏感环境变量（匹配 SECRET、PASSWORD、TOKEN、API_KEY 等模式）

#### 4.8.3 错误类层次

**文件**: [errors.ts](file:///workspace/src/utils/errors.ts)

```
OpenClawError (基类, code + details)
  ├── ChannelError          — 渠道错误 (CHANNEL_ERROR)
  ├── SkillLoadError        — 技能加载失败 (SKILL_LOAD_ERROR)
  ├── SkillExecutionError   — 技能执行失败 (SKILL_EXECUTION_ERROR)
  ├── ToolExecutionError    — 工具执行失败 (TOOL_EXECUTION_ERROR)
  ├── ConfigParseError      — 配置解析失败 (CONFIG_PARSE_ERROR)
  ├── HeartbeatError        — 心跳任务失败 (HEARTBEAT_ERROR)
  └── SessionNotFoundError  — 会话未找到 (SESSION_NOT_FOUND)
```

---

## 5. 技能系统 (`skills`)

技能是 OpenClaw 的扩展机制，每个技能是一个独立目录，包含 `skill.yaml`（元数据）和 `index.ts`（实现）。

### 5.1 技能目录结构

```
skills/
├── weather/           # 天气查询
│   ├── skill.yaml     # 元数据与触发规则
│   └── index.ts       # 工具实现
├── reminder/          # 提醒管理
│   ├── skill.yaml
│   └── index.ts
└── web-search/        # 网页搜索
    ├── skill.yaml
    └── index.ts
```

### 5.2 内置技能详情

#### weather — 天气查询

| 工具 | 说明 | 必需参数 |
|------|------|----------|
| `get_weather` | 获取城市天气 | `city` |

- API: OpenWeatherMap
- 环境变量: `WEATHER_API_KEY`
- 触发关键词: `weather`, `温度`, `天气`, `forecast`, `气温`

#### reminder — 提醒管理

| 工具 | 说明 | 必需参数 |
|------|------|----------|
| `set_reminder` | 设置提醒 | `message`, `time` |
| `list_reminders` | 列出所有提醒 | 无 |
| `cancel_reminder` | 取消提醒 | `reminder_id` |

- 触发关键词: `remind`, `提醒`, `闹钟`, `alarm`, `schedule`
- `time` 支持 ISO 日期字符串或相对分钟数

#### web-search — 网页搜索

| 工具 | 说明 | 必需参数 |
|------|------|----------|
| `web_search` | 搜索网页 | `query` |

- API: DuckDuckGo
- 环境变量: `SEARCH_API_KEY`, `SEARCH_API_URL`
- 触发关键词: `search`, `查找`, `搜索`, `look up`, `find`, `google`

### 5.3 自定义技能开发

1. 在 `skills/` 下创建新目录
2. 编写 `skill.yaml`:

```yaml
name: my-skill
version: 1.0.0
description: 技能描述
triggers:
  - type: keyword
    keywords: [关键词1, 关键词2]
tools:
  - my_tool
permissions:
  - network
```

3. 编写 `index.ts`，导出 `SkillModule` 对象:

```typescript
import type { SkillModule } from '../src/types/skill.js';

const mySkill: SkillModule = {
  name: 'my-skill',
  version: '1.0.0',
  tools: {
    my_tool: {
      name: 'my_tool',
      description: '工具描述',
      parameters: {
        type: 'object',
        properties: { input: { type: 'string', description: '输入' } },
        required: ['input']
      },
      handler: async (params, context) => {
        return { success: true, output: `结果: ${params.input}` };
      }
    }
  }
};

export default mySkill;
```

---

## 6. 配置文件 (`config`)

### 6.1 SOUL.md — AI 灵魂配置

定义 AI 的核心价值观和行为准则。

| 节标题 | 解析字段 | 类型 |
|--------|----------|------|
| `Core Values` / `Values` | `values` | `string` |
| `Behavior` / `Directives` | `behavior` | `string[]` |
| `Guidelines` / `Rules` | `guidelines` | `string[]` |

### 6.2 IDENTITY.md — AI 身份配置

定义 AI 的姓名、背景和性格特征。

| 节标题 | 解析字段 | 类型 |
|--------|----------|------|
| `Name` | `name` | `string` |
| `Background` / `About` | `background` | `string` |
| `Personality` / `Traits` | `personality` | `string[]` |
| `Traits` / `Characteristics` | `traits` | `string[]` |
| `Greeting` / `Intro` | `greeting` | `string?` |

### 6.3 USER.md — 用户偏好配置

定义用户的语言、时区和通知偏好。

| 节标题 | 解析字段 | 类型 |
|--------|----------|------|
| `Name` | `name` | `string` |
| `Language` | `language` | `string` |
| `Timezone` | `timezone` | `string` |
| `Channels` | `channels` | `string[]` |
| `Notifications` | `notificationPreferences.enabled` | `boolean` |
| `Quiet Hours` | `notificationPreferences.quietHours` | `string?` |

### 6.4 HEARTBEAT.md — 定时任务配置

定义 Cron 定时任务。

```markdown
### 任务名称
schedule: 0 8 * * 1-5
timezone: Asia/Shanghai
- notify: 消息内容|渠道名
- run: shell命令
- skill: 技能名|参数JSON
```

---

## 7. 示例应用 (`examples`)

| 文件 | 运行命令 | 说明 | 依赖 |
|------|----------|------|------|
| `simple-app.ts` | `npm run dev` | 完整示例，含 Telegram 适配器 | `TELEGRAM_BOT_TOKEN` |
| `standalone-demo.ts` | `npm run demo` | 独立演示，验证组件初始化 | 无 |
| `tui-app.ts` | `npm run dev:tui` | TUI 终端聊天界面 | `OPENCLAW_API_KEY` |

### 7.1 TUI 示例启动流程

```
loadConfig() → ConfigParser → ToolRegistry → registerBuiltInTools()
→ SkillsLoader → SessionManager → OpenAICompatibleModelCaller
→ AgentRuntimeImpl → setEngineConfig() → ChannelRouterImpl
→ HeartbeatScheduler → TuiAdapter → registerAdapter()
→ heartbeatScheduler.start() → channelRouter.startAll() (阻塞)
```

---

## 8. 依赖关系图

### 8.1 运行时依赖

```
Gateway
  ├── AgentRuntimeImpl
  │     ├── ReactEngine
  │     │     ├── ModelCaller (OpenAICompatibleModelCaller)
  │     │     ├── PromptBuilder
  │     │     └── ToolRegistryContract (ToolRegistry)
  │     └── SessionManager
  ├── ChannelRouterImpl
  │     ├── BaseChannelAdapter (TuiAdapter / TelegramAdapter)
  │     └── SessionManager
  ├── SkillsLoader
  │     └── ToolRegistryContract (ToolRegistry)
  ├── HeartbeatScheduler
  │     ├── CronParser
  │     ├── ToolRegistryContract (ToolRegistry)
  │     └── ChannelRouter
  ├── ConfigParser
  └── ToolRegistry
        └── BuiltInTools (file_read, file_write, http_request, shell)
```

### 8.2 模块导入关系

```
src/index.ts
  ├── types/index.ts (所有类型)
  ├── utils/index.ts (Logger, randomId, filterEnvVars, 错误类)
  ├── channels/index.ts (BaseChannelAdapter, ChannelRouterImpl, TuiAdapter, TelegramAdapter)
  ├── tools/index.ts (ToolRegistry, SkillsLoader, registerBuiltInTools)
  ├── config/index.ts (ConfigParser, loadConfig)
  ├── heartbeat/index.ts (HeartbeatScheduler, CronParser)
  └── agent/runtime.interface.ts (AgentRuntime 接口)
```

### 8.3 外部依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| `axios` | ^1.7.0 | HTTP 客户端（Telegram API、天气 API、搜索 API） |
| `ws` | ^8.18.0 | WebSocket 服务器 |
| `yaml` | ^2.4.0 | YAML 解析（skill.yaml、config.yaml） |

### 8.4 开发依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| `typescript` | ^5.4.0 | 编译器 |
| `tsx` | ^4.22.1 | TypeScript 执行器（开发运行） |
| `jest` | ^29.7.0 | 测试框架 |
| `ts-jest` | ^29.1.0 | Jest TypeScript 转换 |
| `ts-node` | ^10.9.0 | TypeScript Node.js 执行 |
| `eslint` | ^8.57.0 | 代码检查 |
| `@typescript-eslint/*` | ^7.0.0 | TypeScript ESLint 插件 |
| `@types/node` | ^22.0.0 | Node.js 类型定义 |
| `@types/ws` | ^8.5.0 | ws 类型定义 |
| `@types/jest` | ^29.5.0 | Jest 类型定义 |

---

## 9. 数据流与交互逻辑

### 9.1 消息处理主流程

```
用户输入
  │
  ▼
渠道适配器 (TuiAdapter / TelegramAdapter)
  │ normalizeIncoming() → NormalizedMessage
  │ emit('message')
  ▼
ChannelRouterImpl.routeMessage()
  │ resolveSession() → sessionId
  ▼
MessageHandler.onMessage()
  │
  ▼
Gateway.handleIncomingMessage()
  │ NormalizedMessage → Message (role: 'user')
  ▼
AgentRuntimeImpl.processMessage()
  │ getOrCreateSession() → Session
  │ addMessage() → 添加用户消息
  │ build ReactContext
  ▼
ReactEngine.run()
  │
  ├── THINKING: think()
  │     │ ModelCaller.call() → ModelResponse
  │     │ parseThinkResponse() → ThinkDecision
  │     │
  │     ├── shouldRespond=true → 返回最终响应
  │     │
  │     └── shouldRespond=false (有 tool_calls)
  │           │
  │           ▼
  ├── ACTING: act()
  │     │ ToolRegistry.executeTool() → ToolResult[]
  │     │ (并行执行所有工具调用)
  │     ▼
  ├── OBSERVING: formatToolResults()
  │     │ ToolResult[] → Message[] (role: 'tool')
  │     │ push 到消息历史
  │     │ iterationCount++
  │     │
  │     └── 回到 THINKING...
  │
  ▼
AgentResponse
  │
  ▼
Gateway.sendResponse()
  │ AgentResponse → OutboundMessage
  ▼
渠道适配器.send()
  │
  ▼
用户收到回复
```

### 9.2 心跳任务执行流程

```
HeartbeatScheduler (每分钟检查)
  │
  ├── checkAndExecuteTasks()
  │     │ 遍历所有已注册任务
  │     │ 检查 nextRun <= now
  │     │ 检查任务未在运行中
  │     │
  │     ▼
  ├── executeTask()
  │     │ 遍历任务的所有 actions
  │     │
  │     ├── action.type = 'skill'
  │     │     └── ToolRegistry.executeTool(skill, params)
  │     │
  │     ├── action.type = 'notification'
  │     │     └── ChannelRouter.getAdapter(channel).send(message)
  │     │
  │     └── action.type = 'command'
  │           └── ToolRegistry.executeTool('shell', {command})
  │
  └── 更新 nextRun (CronParser.getNextRun)
```

### 9.3 配置加载流程

```
Gateway.start()
  │
  ├── ConfigParser.parseAll()
  │     ├── parseSoul()     ← SOUL.md → SoulConfig
  │     ├── parseIdentity() ← IDENTITY.md → IdentityConfig
  │     └── parseUser()     ← USER.md → UserPreferences
  │
  ├── AgentRuntime.setEngineConfig(soul, identity, user)
  │     └── 创建新的 ReactEngine（含个性化提示词）
  │
  ├── SkillsLoader.loadAll()
  │     └── 扫描 skills/ → 加载 skill.yaml + index.ts → 注册工具
  │
  └── HeartbeatScheduler.loadTasks(configPath)
        └── HEARTBEAT.md → HeartbeatTask[] → 注册调度任务
```

---

## 10. 项目运行方式

### 10.1 环境准备

```bash
# 安装依赖
npm install

# 配置环境变量（创建 .env 文件）
OPENCLAW_API_KEY=your-api-key-here
OPENCLAW_BASE_URL=https://api.deepseek.com
OPENCLAW_MODEL=deepseek-chat
TELEGRAM_BOT_TOKEN=your-telegram-bot-token  # 可选
```

### 10.2 运行命令

| 命令 | 说明 | 需要密钥 |
|------|------|----------|
| `npm run dev:tui` | TUI 终端聊天界面（推荐本地开发） | `OPENCLAW_API_KEY` |
| `npm run demo` | 独立演示（验证组件初始化） | 无 |
| `npm run dev` | 完整示例（含 Telegram） | `TELEGRAM_BOT_TOKEN` |
| `npm run dev:gateway` | Gateway 模式（HTTP/WS 接口） | `OPENCLAW_API_KEY` |
| `npm run dev:src` | 直接运行 src/index.ts | 视情况 |

### 10.3 构建命令

| 命令 | 说明 |
|------|------|
| `npm run build` | TypeScript 编译（输出到 dist/） |
| `npm run typecheck` | 类型检查（不输出文件） |
| `npm run clean` | 清理 dist/ 目录 |
| `npm run rebuild` | 完整重新编译（清理 → 编译 → 清理中间文件） |
| `npm start` | 运行编译后的 dist/index.js |

### 10.4 测试命令

| 命令 | 说明 |
|------|------|
| `npm test` | 运行 Jest 测试 |
| `npm run typecheck` | TypeScript 类型检查 |

---

## 11. 测试体系

### 11.1 测试框架

- **框架**: Jest 29 + ts-jest
- **配置**: [jest.config.ts](file:///workspace/jest.config.ts)
- **测试目录**: `src/__tests__/`
- **匹配模式**: `**/__tests__/**/*.test.ts`

### 11.2 测试文件

| 文件 | 测试目标 |
|------|----------|
| `cron.test.ts` | CronParser 解析、匹配、下次运行时间计算 |
| `prompt.test.ts` | PromptBuilder 提示词构建 |
| `tools.test.ts` | ToolRegistry 注册、执行、过滤 |
| `tui.test.ts` | TuiAdapter 初始化、命令处理 |
| `utils.test.ts` | randomId、filterEnvVars、错误类 |

### 11.3 Jest 配置要点

- 使用 `ts-jest` 预设
- 模块名映射: `^(\\.{1,2}/.*)\\.js$` → `$1`（支持 ESM 风格导入）
- 测试环境: Node.js
- 强制退出: `--forceExit`

---

## 12. 安全机制

### 12.1 SSRF 防护 (`http_request` 工具)

- 屏蔽内网地址: `localhost`, `127.0.0.1`, `0.0.0.0`, `::1`, `169.254.169.254`, `metadata.google.internal`
- 屏蔽私有 IP 段: `10.x`, `127.x`, `172.16-31.x`, `192.168.x`, `169.254.x`, IPv6 私有地址
- 仅允许 `http:` 和 `https:` 协议

### 12.2 命令注入防护 (`shell` 工具)

- 配置级屏蔽: `rm -rf /`, `dd`, `mkfs`, `format`, `shutdown`, `curl|sh`, `wget|sh`
- 正则模式屏蔽: 危险 rm、dd、mkfs、format、shutdown、reboot、curl/wget 管道执行、设备写入、Windows 批量删除、命令替换 `$(...)`、反引号、base64 管道执行、xargs 危险命令
- 工作目录白名单限制

### 12.3 路径安全 (`file_read` / `file_write` 工具)

- 路径白名单机制（默认 `./workspace`）
- 解析符号链接后检查
- 前缀匹配 + 路径分隔符确保目录逃逸不可行

### 12.4 环境变量安全

- `filterEnvVars()` 过滤敏感环境变量（匹配 SECRET、PASSWORD、TOKEN、API_KEY、PRIVATE_KEY、ACCESS_KEY、AUTH、CREDENTIAL 模式）
- 工具执行上下文中的环境变量经过过滤

---

## 13. 错误体系

### 13.1 错误类层次

```
OpenClawError
  ├── code: string           — 错误代码
  └── details?: Record       — 错误详情

  ├── ChannelError           — CHANNEL_ERROR
  │     └── { channel, cause }
  ├── SkillLoadError         — SKILL_LOAD_ERROR
  │     └── { skillName, cause }
  ├── SkillExecutionError    — SKILL_EXECUTION_ERROR
  │     └── { skillName, toolName, cause }
  ├── ToolExecutionError     — TOOL_EXECUTION_ERROR
  │     └── { toolName, cause }
  ├── ConfigParseError       — CONFIG_PARSE_ERROR
  │     └── { configFile, cause }
  ├── HeartbeatError         — HEARTBEAT_ERROR
  │     └── { taskName, cause }
  └── SessionNotFoundError   — SESSION_NOT_FOUND
        └── { sessionId }
```

### 13.2 错误处理策略

| 模块 | 策略 |
|------|------|
| `AgentRuntimeImpl` | 捕获异常，尽力持久化会话状态，返回错误 AgentResponse |
| `ReactEngine` | 达到最大迭代次数返回 FAILED 响应 |
| `ToolRegistry` | 工具未找到或参数校验失败返回 `ToolResult { success: false }` |
| `BaseChannelAdapter` | 可重试错误触发自动重连，不可重试错误通过 `error` 事件上报 |
| `HeartbeatScheduler` | 任务执行失败记录 `lastResult`，计算下次运行时间，失败则禁用任务 |
| `Gateway` | HTTP 请求失败返回 500 + 错误信息 |
| `SessionManager` | 会话未找到抛出 `SessionNotFoundError` |
