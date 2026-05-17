# OpenClaw Minimal

**OpenClaw Minimal** 是一个本地优先（local-first）的 AI Agent 框架，使用 TypeScript 构建。它采用 ReAct（推理+行动）模式，让 AI 能够自主调用工具、执行任务，并通过多渠道与用户交互。

## ✨ 核心特性

- **ReAct 引擎** — 内置推理-行动-观察循环，AI 可自主决策并调用工具
- **多渠道接入** — 支持 Telegram，可扩展接入其他即时通讯平台
- **技能系统** — 基于 YAML 配置的动态技能加载，支持关键字触发
- **内置工具** — 文件读写、HTTP 请求、Shell 命令执行（含 SSRF/命令注入防护）
- **定时任务** — 基于 Cron 表达式的心跳调度系统
- **Markdown 配置** — 用 Markdown 文件定义 AI 的灵魂、身份和用户偏好
- **会话管理** — 带持久化的会话状态管理，支持消息历史截断
- **Gateway 网关** — 提供 HTTP API 和 WebSocket 接口，便于外部集成

## 🏗️ 架构概览

```
┌─────────────────────────────────────────────────────────┐
│                    Gateway 网关层                        │
│              (HTTP / WebSocket 接口)                     │
└────────────────────────┬────────────────────────────────┘
                         │
       ┌─────────────────┼─────────────────┐
       │                 │                 │
       ▼                 ▼                 ▼
┌─────────────┐  ┌──────────────┐  ┌──────────────┐
│   Channel   │  │    Agent     │  │   Skills     │
│   渠道适配器  │  │   运行时     │  │   技能平台    │
│  (Telegram)  │  │ (ReAct 引擎) │  │ (动态加载)    │
└──────┬──────┘  └──────┬───────┘  └──────┬───────┘
       │                │                 │
       └────────────────┼─────────────────┘
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
   ┌────────────┐ ┌──────────┐ ┌──────────────┐
   │  Config    │ │   Tool   │ │  Heartbeat   │
   │  配置解析   │ │  工具注册  │ │  定时调度     │
   └────────────┘ └──────────┘ └──────────────┘
```

## 📋 环境要求

| 依赖 | 版本要求 | 说明 |
|------|---------|------|
| **Node.js** | >= 22.0.0 | 运行时环境 |
| **npm** | 随 Node.js 自带 | 包管理器 |
| **TypeScript** | >= 5.4.0 | 编译器（已包含在 devDependencies） |

> 💡 推荐使用 [nvm](https://github.com/nvm-sh/nvm) 或 [fnm](https://github.com/Schniz/fnm) 管理 Node.js 版本。

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/Hab1nA/oh-my-claw.git
cd oh-my-claw
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量（可选）

如果需要连接 LLM API 或 Telegram，在项目根目录创建 `.env` 文件：

```bash
# LLM API 配置（用于 ReAct 引擎）
OPENCLAW_API_KEY=your-api-key-here
OPENCLAW_BASE_URL=https://api.deepseek.com
OPENCLAW_MODEL=deepseek-chat

# Telegram Bot 配置（用于消息渠道）
TELEGRAM_BOT_TOKEN=your-telegram-bot-token

# 技能 API 密钥（可选）
WEATHER_API_KEY=your-weather-api-key
SEARCH_API_KEY=your-search-api-key
```

### 4. 运行项目

```bash
# 方式一：运行独立演示（无需 API 密钥，验证组件初始化）
npm run demo

# 方式二：运行完整示例（需要 Telegram Bot Token）
npm run dev

# 方式三：运行 Gateway 模式（提供 HTTP/WS 接口）
npm run dev:gateway
```

## 📝 配置说明

所有配置文件位于 `config/` 目录，使用 Markdown 格式，便于人类阅读和编辑。

### SOUL.md — AI 灵魂配置

定义 AI 的核心价值观和行为准则：

```markdown
## Core Values
乐于助人、诚实可靠、尊重用户隐私。

## Behavior
- 简洁明了地回答
- 不确定时主动提问
- 提供可执行的建议

## Guidelines
- 不编造信息
- 危险操作前征求确认
```

### IDENTITY.md — AI 身份配置

定义 AI 的姓名、背景和性格特征：

```markdown
## Name
小助手

## Background
一个友好的 AI 助手，擅长信息检索和任务自动化。

## Personality
- 友善
- 耐心
- 专业
```

### USER.md — 用户偏好配置

定义用户的语言、时区和通知偏好：

```markdown
## Name
张三

## Language
zh-CN

## Timezone
Asia/Shanghai

## Notifications
enabled

## Quiet Hours
22:00 - 08:00
```

### HEARTBEAT.md — 定时任务配置

定义 Cron 定时任务：

```markdown
### 每日早报
schedule: 0 8 * * 1-5
timezone: Asia/Shanghai
- notify: 早上好！以下是今天的日报。|telegram

### 系统检查
schedule: */30 * * * *
- run: echo "系统运行正常"
```

### Gateway 配置

Gateway 使用 JSON 或 YAML 配置文件（`config.json` / `config.yaml`），支持以下配置项：

```json
{
  "port": 18789,
  "host": "127.0.0.1",
  "logLevel": "info",
  "agent": {
    "model": "deepseek-chat",
    "apiKey": "",
    "maxTokens": 2048,
    "temperature": 0.2,
    "maxIterations": 6
  },
  "tools": {
    "timeout": 30000,
    "allowedPaths": ["./workspace"],
    "blockedCommands": ["rm -rf /", "dd", "mkfs"]
  },
  "memory": {
    "storagePath": "./data/sessions",
    "maxHistoryLength": 40
  }
}
```

也可以通过环境变量覆盖配置：`OPENCLAW_PORT`、`OPENCLAW_HOST`、`OPENCLAW_API_KEY` 等。

## 🧩 技能系统

技能是 OpenClaw 的扩展机制，每个技能是一个独立目录，包含：

### 技能目录结构

```
skills/
├── weather/
│   ├── skill.yaml    # 技能元数据与触发规则
│   └── index.ts      # 技能实现（导出工具定义）
├── reminder/
│   ├── skill.yaml
│   └── index.ts
└── web-search/
    ├── skill.yaml
    └── index.ts
```

### skill.yaml 示例

```yaml
name: weather
version: 1.0.0
description: 获取指定城市的天气信息
author: OpenClaw Team
triggers:
  - type: keyword
    keywords:
      - weather
      - 天气
      - 气温
tools:
  - get_weather
permissions:
  - network
```

### 创建自定义技能

1. 在 `skills/` 下创建新目录（如 `skills/my-skill/`）
2. 编写 `skill.yaml` 定义元数据和触发关键词
3. 编写 `index.ts` 实现工具逻辑，导出 `SkillModule` 对象：

```typescript
import type { SkillModule } from '../../src/types/skill.js';

const mySkill: SkillModule = {
  name: 'my-skill',
  version: '1.0.0',
  tools: {
    my_tool: {
      name: 'my_tool',
      description: '这是一个自定义工具',
      category: 'custom',
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string', description: '输入参数' }
        },
        required: ['input']
      },
      handler: async (params, context) => {
        // 工具逻辑
        return { success: true, output: `处理结果: ${params.input}` };
      }
    }
  }
};

export default mySkill;
```

### 内置工具

| 工具名 | 说明 | 安全限制 |
|--------|------|----------|
| `file_read` | 读取本地文件 | 路径白名单限制 |
| `file_write` | 写入本地文件 | 路径白名单限制 |
| `http_request` | 发送 HTTP 请求 | SSRF 防护（屏蔽内网地址） |
| `shell` | 执行 Shell 命令 | 危险命令拦截、路径白名单 |

## 🔧 开发指南

### 常用命令

```bash
# 类型检查
npm run typecheck

# 构建（输出到 dist/）
npm run build

# 运行测试
npm test

# 清理构建产物
npm run clean
```

### 项目结构

```
oh-my-claw/
├── src/
│   ├── agent/                 # Agent 运行时
│   │   ├── model/             # LLM 调用接口（OpenAI 兼容）
│   │   ├── prompt/            # 系统提示词构建
│   │   ├── react/             # ReAct 引擎核心
│   │   ├── session/           # 会话管理
│   │   ├── runtime.ts         # AgentRuntime 实现
│   │   └── runtime.interface.ts
│   ├── channels/              # 渠道适配器
│   │   ├── telegram/          # Telegram 适配器
│   │   ├── adapter.ts         # 适配器基类
│   │   ├── router.ts          # 消息路由
│   │   └── types.ts
│   ├── config/                # 配置解析
│   │   ├── parser.ts          # Markdown 配置解析器
│   │   └── loader.ts          # Gateway 配置加载
│   ├── gateway/               # HTTP/WS 网关
│   │   └── gateway.ts
│   ├── heartbeat/             # 定时调度
│   │   ├── cron.ts            # Cron 表达式解析器
│   │   └── scheduler.ts       # 任务调度器
│   ├── tools/                 # 工具系统
│   │   ├── builtins/          # 内置工具
│   │   ├── registry.ts        # 工具注册表
│   │   └── skills-loader.ts   # 技能加载器
│   ├── types/                 # TypeScript 类型定义
│   ├── utils/                 # 工具函数（日志、ID 生成等）
│   └── index.ts               # 入口导出
├── config/                    # 配置文件目录
│   ├── SOUL.md
│   ├── IDENTITY.md
│   ├── USER.md
│   └── HEARTBEAT.md
├── skills/                    # 技能目录
│   ├── weather/
│   ├── reminder/
│   └── web-search/
├── examples/                  # 示例应用
│   ├── simple-app.ts          # 完整示例（含 Telegram）
│   └── standalone-demo.ts     # 独立演示
├── jest.config.ts
├── tsconfig.json
└── package.json
```

## 📡 API 接口

Gateway 启动后提供以下 HTTP 接口：

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/health` | 健康检查 |
| `GET` | `/sessions/:id` | 获取会话状态 |
| `POST` | `/v1/messages` | 发送消息给 Agent |

**POST /v1/messages 请求示例：**

```json
{
  "sessionId": "my-session",
  "message": "你好，请帮我查一下北京的天气",
  "metadata": { "userId": "user-123" }
}
```

WebSocket 连接地址为 `ws://localhost:18789`，消息格式与 HTTP API 相同。

## 📄 许可证

MIT License
