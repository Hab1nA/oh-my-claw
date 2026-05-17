# OpenClaw Minimal

OpenClaw Minimal is a local-first AI Agent framework built with TypeScript. It provides a ReAct-based agent engine, a channel adapter framework (Telegram supported), a dynamic skills/tool system, markdown-based configuration, and a cron-based heartbeat scheduler — all in a minimal, type-safe package.

## System Requirements

| Software | Version | Notes |
|----------|---------|-------|
| Node.js | >= 22.0.0 | Required (uses ES2022 + NodeNext modules) |
| npm | >= 10.0.0 | Comes with Node.js 22 |
| TypeScript | >= 5.4.0 | Installed automatically as devDependency |

**Supported OS**: Linux (Ubuntu 22.04+), macOS 12.0+, Windows 10+ (via WSL recommended)

**Optional**: Docker (for containerized deployment), PM2 (for production process management)

## Quick Start

### 1. Install Node.js

**Linux (Ubuntu/Debian)**:
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # v22.x.x
npm --version    # >= 10.x.x
```

**macOS (Homebrew)**:
```bash
brew install node@22
node --version
```

**Windows (WSL)**:
```powershell
wsl --install -d Ubuntu
```
Then follow the Linux instructions inside WSL.

### 2. Clone and Install

```bash
git clone <repository-url>
cd OpenClaw-minimal
npm install
```

### 3. Configure

#### 3a. Create a config file (JSON or YAML)

Create `config.json` or `config.yaml` in the project root. The system will auto-detect it. You can also set the `OPENCLAW_CONFIG` environment variable to specify a custom path.

**config.yaml** (recommended):
```yaml
port: 18789
host: 127.0.0.1
logLevel: info

agent:
  model: deepseek-chat
  apiKey: ${OPENCLAW_API_KEY}
  baseUrl: https://api.deepseek.com
  maxTokens: 2048
  temperature: 0.2
  maxIterations: 6

tools:
  timeout: 30000
  allowedPaths:
    - ./workspace
  blockedCommands:
    - rm -rf /
    - dd
    - mkfs

memory:
  storagePath: ./data/sessions
  maxHistoryLength: 40
```

Environment variable placeholders like `${OPENCLAW_API_KEY}` are expanded automatically. You can also override settings via environment variables:

| Variable | Overrides |
|----------|-----------|
| `OPENCLAW_API_KEY` | `agent.apiKey` |
| `OPENCLAW_BASE_URL` | `agent.baseUrl` |
| `OPENCLAW_MODEL` | `agent.model` |
| `OPENCLAW_PORT` | `port` |
| `OPENCLAW_HOST` | `host` |
| `OPENCLAW_LOG_LEVEL` | `logLevel` |

#### 3b. Edit markdown configuration files

Files in `config/` define the agent's personality and behavior:

| File | Purpose |
|------|---------|
| `config/SOUL.md` | Core values, behavior guidelines, and rules |
| `config/IDENTITY.md` | Agent name, background, personality, traits, greeting |
| `config/USER.md` | User name, language, timezone, channels, notifications |
| `config/HEARTBEAT.md` | Cron-based scheduled tasks (morning briefing, health checks, etc.) |

These files are optional — sensible defaults are used when they are absent.

#### 3c. Set up Telegram (optional)

To enable the Telegram channel adapter, set the environment variable:

```bash
export TELEGRAM_BOT_TOKEN=your-bot-token-here
```

To create a Telegram bot:
1. Message `@BotFather` on Telegram
2. Send `/newbot` and follow the instructions
3. Copy the bot token into the environment variable

### 4. Build

```bash
npm run build
```

Compiled output goes to `dist/`. Verify with `ls dist/`.

### 5. Run

**Development mode** (runs via ts-node, no build needed):
```bash
# Full gateway with HTTP/WS server and channel adapters
npm run dev:gateway

# Simple example (minimal integration)
npm run dev

# Standalone demo (no external API required)
npm run demo
```

**Production mode**:
```bash
npm run build
node dist/gateway/index.js
```

**With PM2**:
```bash
npm run build
pm2 start dist/gateway/index.js --name openclaw
pm2 startup
pm2 save
```

### 6. Verify

Once running, the gateway exposes:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `http://localhost:18789/health` | GET | Health check |
| `http://localhost:18789/v1/messages` | POST | Send a message to the agent |
| `http://localhost:18789/sessions/{id}` | GET | Get session state |
| WebSocket `ws://localhost:18789` | — | Real-time bidirectional messaging |

Test with curl:
```bash
curl http://localhost:18789/health
# {"status":"ok","service":"openclaw-minimal-gateway"}

curl -X POST http://localhost:18789/v1/messages \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test","message":"Hello!"}'
```

### 7. Run Tests

```bash
npm test
```

This runs the Jest test suite covering cron parsing, prompt building, tool registry, shell safety, and utility functions.

## Project Structure

```
OpenClaw-minimal/
├── src/
│   ├── agent/                # Agent runtime and ReAct engine
│   │   ├── model/caller.ts   # OpenAI-compatible model caller
│   │   ├── prompt/builder.ts # System prompt builder
│   │   ├── react/engine.ts   # ReAct reasoning engine
│   │   ├── runtime.ts        # Agent runtime implementation
│   │   └── session/manager.ts# Session management with locking
│   ├── channels/             # Channel adapters
│   │   ├── adapter.ts        # Base adapter class
│   │   ├── router.ts         # Message router with session resolution
│   │   ├── types.ts
│   │   └── telegram/         # Telegram adapter
│   ├── config/               # Configuration loading & parsing
│   │   ├── loader.ts         # YAML/JSON config with env expansion
│   │   └── parser.ts         # Markdown config parser
│   ├── gateway/              # HTTP/WS gateway server
│   │   ├── gateway.ts        # Gateway class
│   │   └── index.ts          # Entry point
│   ├── heartbeat/            # Cron-based scheduler
│   │   ├── cron.ts           # Cron expression parser
│   │   └── scheduler.ts      # Task scheduler
│   ├── tools/                # Tool system
│   │   ├── registry.ts       # Tool registry
│   │   ├── skills-loader.ts  # Dynamic skill loader
│   │   └── builtins/         # Built-in tools (shell, http, file-read, file-write)
│   ├── types/                # TypeScript type definitions
│   ├── utils/                # Utilities (logger, id generator, errors)
│   └── __tests__/            # Unit tests
├── config/                   # Markdown configuration files
│   ├── SOUL.md
│   ├── IDENTITY.md
│   ├── USER.md
│   └── HEARTBEAT.md
├── skills/                   # Skill modules
│   ├── weather/
│   ├── reminder/
│   └── web-search/
├── examples/                 # Example applications
├── package.json
├── tsconfig.json
└── jest.config.ts
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run typecheck` | Run TypeScript type checking (no emit) |
| `npm run dev` | Run simple-app example via ts-node |
| `npm run demo` | Run standalone demo via ts-node |
| `npm run dev:gateway` | Run the full gateway via ts-node |
| `npm run start` | Run compiled gateway from `dist/` |
| `npm test` | Run Jest test suite |
| `npm run clean` | Remove `dist/` directory |

## Configuration Reference

### Gateway Config (config.json / config.yaml)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `port` | number | `18789` | HTTP/WS server port |
| `host` | string | `"127.0.0.1"` | Server bind address |
| `logLevel` | string | `"info"` | Logging level: `debug`, `info`, `warn`, `error` |
| `agent.model` | string | `"deepseek-chat"` | LLM model name |
| `agent.apiKey` | string | `""` | API key for the model provider |
| `agent.baseUrl` | string | `"https://api.deepseek.com"` | API base URL |
| `agent.maxTokens` | number | `2048` | Max tokens per response |
| `agent.temperature` | number | `0.2` | Sampling temperature |
| `agent.maxIterations` | number | `6` | Max ReAct reasoning loops |
| `tools.timeout` | number | `30000` | Tool execution timeout (ms) |
| `tools.allowedPaths` | string[] | `["./workspace"]` | File system paths the agent can access |
| `tools.blockedCommands` | string[] | — | Shell commands the agent is forbidden to run |
| `memory.storagePath` | string | `"./data/sessions"` | Session data storage directory |
| `memory.maxHistoryLength` | number | `40` | Max conversation history per session |

### Markdown Configuration Format

**SOUL.md** — Uses `##` headings for sections: `Core Values`, `Behavior`, `Guidelines`. List items use `- ` prefix.

**IDENTITY.md** — Sections: `Name`, `Background`, `Personality`, `Traits`, `Greeting`. Supports YAML front matter (`---` delimited block at the top).

**USER.md** — Sections: `Name`, `Language`, `Timezone`, `Channels`, `Notifications`, `Quiet Hours`.

**HEARTBEAT.md** — Each task is a `###` heading. Use `schedule:` for cron expression, `timezone:` for timezone, `- notify:` for notification actions (format: `message|channel`), `- run:` for shell command actions.

### Heartbeat Cron Format

Standard 5-field cron: `minute hour day-of-month month day-of-week`

Examples:
- `0 8 * * 1-5` — Weekdays at 8:00
- `*/30 * * * *` — Every 30 minutes
- `0 18 * * 5` — Every Friday at 18:00

## Skill Development

Skills are loaded from the `skills/` directory at startup. Each skill is a subdirectory containing:

### skill.yaml

```yaml
name: my-skill
version: 1.0.0
description: Description of my skill
author: Your Name
triggers:
  - type: keyword
    keywords:
      - trigger-word
      - another-word
tools:
  - my_tool_name
permissions:
  - network
```

### index.ts

```typescript
import type { SkillModule } from '../src/types/skill';

const mySkill: SkillModule = {
  name: 'my-skill',
  version: '1.0.0',
  tools: {
    my_tool_name: {
      name: 'my_tool_name',
      description: 'Tool description',
      parameters: {
        type: 'object',
        properties: {
          param1: { type: 'string', description: 'Parameter 1' }
        },
        required: ['param1']
      },
      handler: async (params) => {
        return { success: true, output: 'Result' };
      }
    }
  }
};

export default mySkill;
```

## Built-in Tools

The following tools are registered automatically at startup:

| Tool | Description |
|------|-------------|
| `file_read` | Read file contents within allowed paths |
| `file_write` | Write files within allowed paths |
| `shell` | Execute shell commands (with dangerous command detection) |
| `http_request` | Make HTTP requests (with SSRF protection and private IP blocking) |

## Security Features

- **Shell safety**: Dangerous commands (`rm -rf /`, `curl | sh`, subshell execution, base64 pipe, etc.) are blocked by pattern matching
- **SSRF protection**: HTTP tool blocks requests to private IPs (10.x, 127.x, 192.168.x, etc.) and metadata endpoints
- **Path policy**: File tools restrict access to configured `allowedPaths`
- **Sensitive env filtering**: Environment variables matching patterns like `SECRET`, `PASSWORD`, `TOKEN`, `API_KEY` are excluded from agent context
- **Session locking**: Concurrent session modifications are serialized with per-session locks
- **Model call timeout**: API calls abort after 120 seconds

## Docker Deployment

```dockerfile
FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist/ ./dist/
COPY config/ ./config/
COPY skills/ ./skills/
EXPOSE 18789
CMD ["node", "dist/gateway/index.js"]
```

Build and run:
```bash
npm run build
docker build -t openclaw-minimal .
docker run -d \
  -p 18789:18789 \
  -e OPENCLAW_API_KEY=your-api-key \
  -e TELEGRAM_BOT_TOKEN=your-bot-token \
  -v $(pwd)/config:/app/config \
  -v $(pwd)/skills:/app/skills \
  openclaw-minimal
```

## FAQ

**Q: How do I get a Telegram bot token?**
A: Message `@BotFather` on Telegram, send `/newbot`, and follow the instructions.

**Q: How do I get an LLM API key?**
A: The default provider is DeepSeek. Sign up at [platform.deepseek.com](https://platform.deepseek.com) and create an API key. You can also switch to any OpenAI-compatible provider by changing `agent.baseUrl` and `agent.model`.

**Q: The bot doesn't respond on Telegram.**
A: Check that: (1) `TELEGRAM_BOT_TOKEN` is set correctly, (2) the application is running, (3) no firewall blocks outbound HTTPS connections to `api.telegram.org`, (4) check logs for errors.

**Q: How do I deploy to production?**
A: Use Docker or PM2. With PM2:
```bash
pm2 start dist/gateway/index.js --name openclaw
pm2 startup
pm2 save
```

**Q: Can I use a different LLM provider?**
A: Yes. Set `agent.baseUrl` to any OpenAI-compatible endpoint and `agent.model` to the model name. For example, to use OpenAI:
```yaml
agent:
  model: gpt-4o
  apiKey: ${OPENAI_API_KEY}
  baseUrl: https://api.openai.com/v1
```

## License

MIT
