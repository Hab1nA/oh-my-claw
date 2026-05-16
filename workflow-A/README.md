# OpenClaw-Minimal Core Runtime

本项目是课程大作业中“任务流甲：核心运行时与工具系统”的最小化实现。它实现了一个本地优先的 OpenClaw 风格 Agent 核心引擎，包含 Gateway 主进程、Agent Runtime、ReAct 状态机、LLM tool_calls 处理、工具注册与调用系统、会话管理和上下文截断。

项目定位不是完整复刻 OpenClaw，而是实现一个结构清晰、可运行、可测试、可扩展的核心运行时，方便与“任务流乙”的 Channel Adapter、Skills Platform、Heartbeat 等模块继续集成。

## 1. 已实现功能

### 1.1 Gateway 主进程

入口文件：

```text
src/gateway/index.ts
```

已实现：

- 进程启动与停止
- `SIGINT` / `SIGTERM` 优雅关闭
- JSON / 简化 YAML 配置加载
- 环境变量覆盖配置
- HTTP 服务初始化
- WebSocket 最小文本消息服务
- 结构化日志输出

默认监听：

```text
127.0.0.1:18789
```

### 1.2 Agent Runtime

核心文件：

```text
src/agent/runtime.ts
src/agent/runtime.interface.ts
```

关键接口：

```ts
processMessage(sessionId: string, message: Message): Promise<AgentResponse>
```

该接口是与任务流乙 Channel Adapter 对接的核心契约。无论后续接 Telegram、Web UI、CLI 还是其他消息渠道，都可以统一调用这个接口。

### 1.3 ReAct 状态机

核心文件：

```text
src/agent/react/engine.ts
src/agent/react/types.ts
```

已实现标准 ReAct 循环：

```text
THINKING -> ACTING -> OBSERVING -> THINKING -> ... -> FINISHED
```

状态包括：

```ts
THINKING
ACTING
OBSERVING
FINISHED
FAILED
```

运行逻辑：

1. Gateway 接收用户消息。
2. AgentRuntime 将消息加入 Session。
3. ReactEngine 进入 `THINKING` 状态，调用 LLM。
4. 如果 LLM 返回普通文本，进入 `FINISHED`。
5. 如果 LLM 返回 `tool_calls`，进入 `ACTING`。
6. ToolRegistry 执行对应工具。
7. 工具结果作为 `tool` 消息重新注入上下文，进入 `OBSERVING`。
8. LLM 基于工具结果继续推理，直到输出最终回答。

### 1.4 LLM 调用层

核心文件：

```text
src/agent/model/caller.ts
src/agent/model/interface.ts
```

支持 OpenAI-compatible API，例如：

- DeepSeek
- OpenAI
- 通义千问 OpenAI-compatible endpoint
- 其他兼容 `/chat/completions` 的模型服务

已支持：

- `messages`
- `tools`
- `tool_choice: auto`
- `tool_calls` 解析
- 工具结果消息重新提交
- API 错误返回处理

### 1.5 ToolRegistry 工具系统

核心文件：

```text
src/tools/registry.ts
src/tools/types.ts
src/tools/registry.interface.ts
```

已实现：

- 工具注册
- 工具注销
- 工具查询
- 工具过滤
- 参数校验
- 统一执行入口
- 工具超时控制
- 工具执行上下文

核心接口：

```ts
registerTool(tool: ToolDefinition): void
unregisterTool(name: string): boolean
getTool(name: string): ToolDefinition | undefined
listTools(filter?: ToolFilter): ToolDefinition[]
executeTool(name: string, params: Record<string, unknown>): Promise<ToolResult>
```

### 1.6 内置工具

目录：

```text
src/tools/builtins/
```

已实现工具：

```text
file_read
file_write
shell
http_request
```

#### file_read

读取配置允许目录内的文件。

安全约束：

- 路径必须位于 `tools.allowedPaths` 内
- 支持编码、最大读取行数、行偏移

#### file_write

向配置允许目录内写入文件。

安全约束：

- 路径必须位于 `tools.allowedPaths` 内
- 支持自动创建目录
- 支持写入前备份

#### shell

执行受限 Shell 命令。

安全约束：

- 工作目录必须位于 `tools.allowedPaths` 内
- 包含危险命令黑名单
- 包含超时控制

默认拦截示例：

```text
rm -rf /
dd
mkfs
format
shutdown
curl ... | sh
wget ... | sh
```

#### http_request

发送 HTTP 请求。

支持：

```text
GET
POST
PUT
DELETE
PATCH
```

### 1.7 SessionManager 会话管理

核心文件：

```text
src/agent/session/manager.ts
src/agent/session/types.ts
```

已实现：

- 创建会话
- 恢复会话
- 添加消息
- 替换消息历史
- 会话状态管理
- 会话持久化
- 上下文截断

会话文件默认保存到：

```text
data/sessions/
```

上下文截断策略：

- 保留最近消息
- 保留标记为 `isImportant` 的重要消息
- 防止历史过长导致 token 溢出

## 2. 项目结构

```text
src/
├── gateway/
│   ├── index.ts
│   ├── gateway.ts
│   ├── config/
│   │   ├── loader.ts
│   │   └── types.ts
│   └── utils/
│       ├── errors.ts
│       └── logger.ts
├── agent/
│   ├── runtime.ts
│   ├── runtime.interface.ts
│   ├── model/
│   │   ├── caller.ts
│   │   └── interface.ts
│   ├── prompt/
│   │   └── builder.ts
│   ├── react/
│   │   ├── engine.ts
│   │   └── types.ts
│   └── session/
│       ├── manager.ts
│       └── types.ts
├── tools/
│   ├── registry.ts
│   ├── registry.interface.ts
│   ├── types.ts
│   └── builtins/
│       ├── file-read.ts
│       ├── file-write.ts
│       ├── http.ts
│       ├── index.ts
│       ├── path-policy.ts
│       └── shell.ts
└── shared/
    └── types.ts
```

## 3. 环境要求

推荐环境：

```text
Node.js >= 22
npm >= 10
TypeScript >= 5
```

本机测试环境：

```text
Node.js v24.14.0
npm 11.9.0
```

PowerShell 如果禁止直接运行 `npm`，请使用：

```powershell
npm.cmd
```

## 4. 安装与构建

进入项目目录：

```powershell
cd C:\Users\18622\Documents\Codex\2026-05-16\files-mentioned-by-the-user-5f66944b524d0476047ded7d962a6cb6
```

安装依赖：

```powershell
npm.cmd install
```

类型检查：

```powershell
npm.cmd run check
```

构建：

```powershell
npm.cmd run build
```

启动：

```powershell
npm.cmd start
```

启动成功后会看到类似日志：

```json
{"time":"2026-05-16T04:50:56.504Z","level":"info","message":"Gateway started on 127.0.0.1:18789"}
```

## 5. 配置 DeepSeek API

本项目支持 DeepSeek 的 OpenAI-compatible API。

在启动 Gateway 的同一个 PowerShell 窗口中设置：

```powershell
$env:OPENCLAW_API_KEY="你的DeepSeek API Key"; $env:OPENCLAW_BASE_URL="https://api.deepseek.com"; $env:OPENCLAW_MODEL="deepseek-chat"
```

然后启动：

```powershell
npm.cmd start
```

注意：

- API Key 不要写进代码。
- API Key 不要提交到 Git。
- 如果已经把 Key 发给他人或贴到公开位置，应立即在 DeepSeek 后台作废并重新生成。
- DeepSeek 网页聊天额度和 API 余额可能不是一回事，需要确认 API 账户余额。

也可以复制配置文件：

```powershell
Copy-Item config.example.json config.json
```

然后在 `config.json` 中调整：

```json
{
  "agent": {
    "model": "deepseek-chat",
    "apiKey": "${OPENCLAW_API_KEY}",
    "baseUrl": "https://api.deepseek.com"
  }
}
```

## 6. HTTP 接口

### 6.1 健康检查

```text
GET /health
```

PowerShell 测试：

```powershell
Invoke-RestMethod http://127.0.0.1:18789/health
```

预期返回：

```json
{
  "status": "ok",
  "service": "openclaw-minimal-gateway"
}
```

### 6.2 发送用户消息

```text
POST /v1/messages
```

请求体：

```json
{
  "sessionId": "demo",
  "message": "用户消息",
  "metadata": {
    "userId": "user-1",
    "channel": "telegram"
  }
}
```

返回体：

```json
{
  "message": "Agent最终回复",
  "type": "final",
  "metadata": {
    "state": "FINISHED",
    "iterations": 1
  }
}
```

### 6.3 查询会话状态

```text
GET /sessions/{sessionId}
```

示例：

```powershell
Invoke-RestMethod http://127.0.0.1:18789/sessions/demo
```

## 7. Windows 中文测试注意事项

PowerShell 直接用 `-Body '{"message":"中文"}'` 可能导致中文乱码。推荐使用 UTF-8 字节方式发送请求。

普通 LLM 对话测试：

```powershell
$body=@{sessionId="utf8-test";message="你好，请介绍一下你能做什么"}|ConvertTo-Json -Compress; Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:18789/v1/messages" -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) | ConvertTo-Json -Depth 10
```

ReAct + 文件读取 + LLM 总结测试：

```powershell
$body=@{sessionId="react-utf8-test";message="请读取 workspace/project_brief.txt，并总结这个项目的核心功能"}|ConvertTo-Json -Compress; Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:18789/v1/messages" -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) | ConvertTo-Json -Depth 10
```

用户反馈分类测试：

```powershell
$body=@{sessionId="feedback-utf8-test";message="请读取 workspace/customer_feedback.txt，把用户反馈分为正向反馈、负向反馈和改进建议，并给出优先级排序"}|ConvertTo-Json -Compress; Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:18789/v1/messages" -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) | ConvertTo-Json -Depth 10
```

## 8. 推荐测试流程

### 8.1 基础链路测试

启动 Gateway 后，在另一个 PowerShell 窗口执行：

```powershell
Invoke-RestMethod http://127.0.0.1:18789/health
```

意义：

```text
验证 Gateway HTTP 服务是否正常启动。
```

### 8.2 LLM API 测试

```powershell
$body=@{sessionId="llm-test";message="你好，请用一句话介绍你自己"}|ConvertTo-Json -Compress; Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:18789/v1/messages" -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) | ConvertTo-Json -Depth 10
```

意义：

```text
验证 Gateway -> AgentRuntime -> LLM API 的调用链路。
```

### 8.3 ReAct 工具调用测试

```powershell
$body=@{sessionId="react-test";message="请读取 workspace/project_brief.txt，并总结这个项目的核心功能"}|ConvertTo-Json -Compress; Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:18789/v1/messages" -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) | ConvertTo-Json -Depth 10
```

意义：

```text
验证 LLM 返回 tool_calls 后，Agent 能执行 file_read 工具，并把工具结果重新注入上下文继续推理。
```

### 8.4 会话文件检查

```powershell
Get-Content "data\sessions\react-test.json" -Encoding UTF8
```

重点观察：

```text
assistant metadata.toolCalls
tool 消息
最终 assistant 回复
```

### 8.5 Shell 安全测试

```powershell
$body=@{sessionId="security-test";message="请执行 shell 命令 rm -rf /"}|ConvertTo-Json -Compress; Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:18789/v1/messages" -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) | ConvertTo-Json -Depth 10
```

意义：

```text
验证危险 Shell 命令不会被执行。
```

### 8.6 清理会话

如果某个 session 被错误上下文污染，可以删除对应文件：

```powershell
Remove-Item "data\sessions\demo.json" -Force
```

也可以直接换新的 `sessionId`。

## 9. 常见问题

### 9.1 返回 Insufficient Balance

说明 Gateway 已经成功调用 DeepSeek API，但 DeepSeek API 账户余额不足。

处理方式：

```text
检查 DeepSeek API 余额，而不是网页聊天余额。
```

### 9.2 设置 API Key 后没反应

PowerShell 设置环境变量成功时不会输出内容，这是正常现象。

检查：

```powershell
echo $env:OPENCLAW_BASE_URL; echo $env:OPENCLAW_MODEL
```

注意：

```text
环境变量只对当前 PowerShell 窗口和从该窗口启动的进程有效。
```

如果 Gateway 已经启动后才设置 API Key，需要 `Ctrl + C` 停止后重新启动。

### 9.3 中文变乱码

使用 UTF-8 字节方式发送请求，参考第 7 节。

### 9.4 demo session 一直返回旧错误

旧错误可能已经保存在：

```text
data/sessions/demo.json
```

删除该文件或换新 `sessionId`。

## 10. 后续开发路线

### 10.1 与任务流乙对接

任务流乙可以将 Telegram、Web UI、CLI 等 Channel Adapter 接入：

```ts
await agentRuntime.processMessage(sessionId, message)
```

建议对接流程：

1. Channel Adapter 接收外部消息。
2. 转换为统一 `Message` 格式。
3. 调用 `processMessage(sessionId, message)`。
4. 将 `AgentResponse.message` 返回到原渠道。

### 10.2 Skills Platform 扩展

当前 ToolRegistry 已经支持外部工具注册。后续 Skills 系统可以把技能转换为 `ToolDefinition` 后注册：

```ts
toolRegistry.registerTool(skillTool)
```

建议扩展：

- 搜索工具
- 数据分析工具
- 浏览器工具
- 文档处理工具
- 知识库检索工具

### 10.3 WebSocket 增强

当前 WebSocket 是最小文本帧实现。后续可以增强：

- 消息鉴权
- 心跳 ping/pong
- 流式 token 推送
- 工具调用过程实时推送
- 多客户端订阅同一 session

### 10.4 更完整的配置系统

当前配置支持 JSON 和简化 YAML。后续可以增强：

- 使用标准 YAML 解析库
- 配置 schema 校验
- 多环境配置
- 用户级配置
- SOUL.md / IDENTITY.md 加载

### 10.5 更强的安全沙箱

当前安全策略是最小可用版本。后续可以增加：

- Shell 命令白名单
- 每个工具单独权限
- 用户确认机制
- 文件写入审批
- 网络域名 allowlist
- 工具调用审计日志

### 10.6 上下文与记忆增强

当前 SessionManager 只做基础历史截断。后续可以增加：

- 对话摘要
- 长期记忆
- 向量检索
- 用户偏好记录
- 重要事件提取
- session 过期清理

### 10.7 流式响应

当前模型调用是非流式。后续可以扩展：

```ts
callStream(prompt, onChunk)
```

并通过 WebSocket 推送到 Channel Adapter。

## 11. 报告写作建议

### 11.1 推荐题目

```text
OpenClaw-Minimal 核心运行时与工具系统的设计与实现
```

### 11.2 摘要可写内容

本文面向 OpenClaw 风格智能体系统，设计并实现了一个最小化核心运行时 OpenClaw-Minimal。系统采用 Node.js 和 TypeScript 开发，包含 Gateway 主进程、Agent Runtime、ReAct 推理循环、OpenAI-compatible 模型调用层、工具注册与执行系统、会话管理和上下文截断机制。系统支持 HTTP/WebSocket 消息入口，能够接收用户请求，调用大语言模型进行推理，并根据模型返回的 tool_calls 执行本地工具。实验结果表明，该系统能够完成普通对话、文件读取总结、用户反馈分类等任务，并通过 Shell 黑名单和 allowedPaths 路径限制提供基础安全保障。

### 11.3 章节结构

建议报告结构：

```text
1. 绪论
2. OpenClaw-Minimal 总体架构
3. Gateway 主进程设计
4. Agent Runtime 与 ReAct 状态机
5. 工具注册与调用系统
6. 会话管理与上下文截断
7. 系统安全设计
8. 实验测试与结果分析
9. 不足与后续工作
10. 总结
```

### 11.4 架构图文字版

可以在报告中使用：

```text
外部渠道 / HTTP / WebSocket
          |
          v
      Gateway
          |
          v
   AgentRuntime
          |
          v
   ReAct Engine
    |     |     |
    v     v     v
 Model  Session ToolRegistry
 Caller Manager     |
                    v
          file_read / file_write / shell / http_request
```

### 11.5 核心流程图文字版

```text
用户输入
  |
  v
processMessage(sessionId, message)
  |
  v
写入 Session 历史
  |
  v
THINKING：调用 LLM
  |
  +-- 普通回答 --> FINISHED
  |
  +-- tool_calls --> ACTING：执行工具
                         |
                         v
                  OBSERVING：工具结果写回上下文
                         |
                         v
                    再次 THINKING
```

### 11.6 关键代码说明

报告可以重点解释这些文件：

```text
src/gateway/index.ts
```

说明 Gateway 如何启动、加载配置、注册信号处理。

```text
src/gateway/gateway.ts
```

说明 HTTP/WebSocket 如何接收外部消息，并转交给 AgentRuntime。

```text
src/agent/runtime.ts
```

说明 `processMessage(sessionId, message)` 如何维护会话、调用 ReActEngine、保存最终回复。

```text
src/agent/react/engine.ts
```

说明 `THINKING`、`ACTING`、`OBSERVING` 状态机如何实现。

```text
src/tools/registry.ts
```

说明工具注册、参数校验和超时控制。

```text
src/tools/builtins/shell.ts
src/tools/builtins/file-read.ts
src/tools/builtins/file-write.ts
```

说明安全限制如何实现。

### 11.7 实验设计

实验一：Gateway 健康检查

目的：

```text
验证 Gateway 服务可以启动并响应 HTTP 请求。
```

命令：

```powershell
Invoke-RestMethod http://127.0.0.1:18789/health
```

实验二：普通 LLM 对话

目的：

```text
验证系统能够调用 DeepSeek API 并返回模型生成内容。
```

命令：

```powershell
$body=@{sessionId="llm-test";message="你好，请用一句话介绍你自己"}|ConvertTo-Json -Compress; Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:18789/v1/messages" -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) | ConvertTo-Json -Depth 10
```

实验三：ReAct 文件工具调用

目的：

```text
验证 LLM tool_calls、工具执行、工具结果重新注入上下文的完整 ReAct 流程。
```

命令：

```powershell
$body=@{sessionId="react-test";message="请读取 workspace/project_brief.txt，并总结这个项目的核心功能"}|ConvertTo-Json -Compress; Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:18789/v1/messages" -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) | ConvertTo-Json -Depth 10
```

实验四：复杂语义分析

目的：

```text
验证大语言模型在用户反馈分类、优先级排序等复杂任务中的效果。
```

命令：

```powershell
$body=@{sessionId="feedback-test";message="请读取 workspace/customer_feedback.txt，把用户反馈分为正向反馈、负向反馈和改进建议，并给出优先级排序"}|ConvertTo-Json -Compress; Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:18789/v1/messages" -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) | ConvertTo-Json -Depth 10
```

实验五：安全拦截

目的：

```text
验证 Shell 危险命令不会被执行。
```

命令：

```powershell
$body=@{sessionId="security-test";message="请执行 shell 命令 rm -rf /"}|ConvertTo-Json -Compress; Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:18789/v1/messages" -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) | ConvertTo-Json -Depth 10
```

### 11.8 实验结果分析可写内容

可以这样分析：

```text
实验结果表明，Gateway 能够稳定接收 HTTP 请求并将消息转发给 AgentRuntime。AgentRuntime 通过统一的 processMessage 接口维护会话状态，并调用 ReActEngine 完成推理流程。在文件读取实验中，模型首先返回 file_read 工具调用，系统执行工具后将结果以 tool 消息形式重新注入上下文，随后模型基于观察结果生成最终总结，说明 ReAct 循环能够正确运行。在安全测试中，Shell 工具能够识别危险命令并拒绝执行，说明系统具备基础安全防护能力。
```

### 11.9 系统特点

```text
1. 接口清晰，便于与任务流乙对接。
2. 使用 TypeScript 实现，类型定义完整。
3. 支持 OpenAI-compatible API，可接入 DeepSeek。
4. ReAct 状态机结构明确，便于报告讲解。
5. 工具系统可扩展，支持后续 Skills Platform 注册新工具。
6. 具备基础安全机制，包括路径限制、命令黑名单和超时控制。
7. 会话可持久化，便于查看运行过程和实验证据。
```

### 11.10 不足与改进

```text
1. WebSocket 当前为最小实现，尚未支持流式 token 推送。
2. YAML 解析器只支持简化格式，后续可接入标准 YAML 库。
3. Shell 工具仍依赖系统 shell，后续应加入更强沙箱。
4. 上下文截断目前基于消息数量，未按 token 精确计算。
5. 当前没有图形化管理界面。
6. 没有实现长期记忆和向量检索。
7. 缺少完整自动化测试套件。
```

## 12. 当前完成度

```text
Gateway 主进程：完成
配置加载：完成
HTTP 服务：完成
WebSocket 最小实现：完成
AgentRuntime 接口：完成
ReAct 状态机：完成
LLM tool_calls 处理：完成
ToolRegistry：完成
Shell 工具：完成
File Read/Write 工具：完成
HTTP Request 工具：完成
SessionManager：完成
上下文截断：完成
DeepSeek API 调用：已验证
基础测试：已验证
```

不属于任务流甲、后续由任务流乙或扩展阶段完成的内容：

```text
Telegram Adapter
完整 Channel Adapter 框架
Skills Platform 高级技能系统
Heartbeat 主动服务
Web UI
长期记忆系统
```

