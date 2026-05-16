# OpenClaw Minimal - README-B

OpenClaw Minimal is a local-first AI Agent framework built with TypeScript. This document provides complete instructions for setting up and running the application from scratch.

## 📋 System Requirements

### Required Software

| Software | Version | Description |
|----------|---------|-------------|
| Node.js | >= 22.0.0 | JavaScript runtime |
| npm | >= 10.0.0 | Package manager |
| TypeScript | >= 5.4.0 | Type checking |

### Supported Operating Systems

- **Linux**: Ubuntu 22.04+, Debian 12+, Fedora 38+
- **macOS**: 12.0+ (Intel/Apple Silicon)
- **Windows**: Windows 10+ (via WSL recommended)

### Optional Dependencies

| Software | Purpose |
|----------|---------|
| Docker | Containerized deployment |
| PM2 | Process management for production |

## 🚀 Quick Start

### Step 1: Install System Dependencies

#### Linux (Ubuntu/Debian)
```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 22 and npm
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v22.x.x
npm --version   # Should show >=10.x.x
```

#### macOS (Homebrew)
```bash
# Install Homebrew if not installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node@22

# Verify installation
node --version
npm --version
```

#### Windows (WSL)
```powershell
# Open PowerShell as Administrator and enable WSL
wsl --install -d Ubuntu
```
Then follow the Linux instructions inside the WSL terminal.

### Step 2: Clone and Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd OpenClaw-minimal

# Install npm dependencies
npm install

# Verify installation
npm list  # Should show no errors
```

### Step 3: Build the Project

```bash
# Run TypeScript compilation
npm run build

# Verify build succeeded
ls -la dist/  # Should show compiled JavaScript files
```

### Step 4: Configure the Application

#### Environment Variables

Create a `.env` file in the project root:

```bash
touch .env
```

Add the following configuration:

```env
# Telegram Bot Configuration (optional)
TELEGRAM_BOT_TOKEN=your-bot-token-here
TELEGRAM_WEBHOOK_URL=https://your-domain.com/webhook/telegram
TELEGRAM_WEBHOOK_SECRET=your-secret-key

# Weather API (for weather skill)
WEATHER_API_KEY=your-openweathermap-api-key

# Search API (for web-search skill)
SEARCH_API_KEY=your-search-api-key

# Log Level
LOG_LEVEL=info
```

#### Configuration Files

Edit files in the `config/` directory:

| File | Purpose |
|------|---------|
| `SOUL.md` | Define core values and behavior guidelines |
| `IDENTITY.md` | Set agent identity, personality, and greeting |
| `USER.md` | Configure user preferences |
| `HEARTBEAT.md` | Define scheduled tasks |

### Step 5: Run the Application

#### Development Mode
```bash
# Run standalone demo (no external dependencies)
npm run demo

# Run full application (requires Telegram bot setup)
npm run dev
```

#### Production Mode
```bash
# Build first
npm run build

# Start with PM2
pm2 start dist/gateway/index.js --name openclaw
```

### Step 6: Test Telegram Integration

1. **Create a Telegram Bot**:
   - Message `@BotFather` on Telegram
   - Send `/newbot` and follow instructions
   - Copy the bot token

2. **Configure the Bot**:
   - Paste the token into `.env` as `TELEGRAM_BOT_TOKEN`
   - Restart the application

3. **Test the Bot**:
   - Search for your bot on Telegram
   - Send a message like "Hello" or "What's the weather today?"

## 📁 Project Structure

```
OpenClaw-minimal/
├── src/                          # Source code
│   ├── agent/                    # Agent Runtime interface
│   │   └── runtime.interface.ts
│   ├── channels/                 # Channel adapters
│   │   ├── adapter.ts            # Base adapter class
│   │   ├── router.ts             # Message router
│   │   ├── types.ts
│   │   └── telegram/
│   │       └── adapter.ts        # Telegram adapter
│   ├── config/                   # Configuration parsing
│   │   ├── parser.ts
│   │   └── index.ts
│   ├── gateway/                  # Main gateway
│   │   ├── index.ts              # Entry point
│   │   └── gateway.ts            # Gateway class
│   ├── heartbeat/                # Scheduler system
│   │   ├── cron.ts               # Cron parser
│   │   ├── scheduler.ts          # Task scheduler
│   │   └── index.ts
│   ├── tools/                    # Tools system
│   │   ├── registry.ts           # Tool registry
│   │   ├── skills-loader.ts      # Skills loader
│   │   └── index.ts
│   ├── types/                    # TypeScript types
│   │   ├── config.ts
│   │   ├── heartbeat.ts
│   │   ├── message.ts
│   │   ├── session.ts
│   │   ├── skill.ts
│   │   ├── tool.ts
│   │   └── index.ts
│   ├── utils/                    # Utility functions
│   │   ├── errors.ts             # Custom errors
│   │   ├── logger.ts             # Logger
│   │   └── index.ts
│   └── index.ts                  # Main export
├── config/                       # Configuration files
│   ├── SOUL.md                   # Core values
│   ├── IDENTITY.md               # Agent identity
│   ├── USER.md                   # User preferences
│   └── HEARTBEAT.md              # Scheduled tasks
├── skills/                       # Skills directory
│   ├── weather/                  # Weather skill
│   │   ├── skill.yaml
│   │   └── index.ts
│   ├── reminder/                 # Reminder skill
│   │   ├── skill.yaml
│   │   └── index.ts
│   └── web-search/               # Web search skill
│       ├── skill.yaml
│       └── index.ts
├── examples/                     # Example applications
│   ├── simple-app.ts             # Simple integration example
│   └── standalone-demo.ts        # Standalone demo
├── dist/                         # Compiled output (after build)
├── .env                          # Environment variables
├── package.json                  # Project configuration
├── tsconfig.json                 # TypeScript configuration
└── README.md                     # This file
```

## 🛠️ Available Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run dev` | Run development server |
| `npm run demo` | Run standalone demo |
| `npm run dev:gateway` | Run gateway directly |
| `npm run test` | Run tests |
| `npm run clean` | Clean build output |

## 🔧 Configuration Reference

### .env File Options

```env
# Telegram
TELEGRAM_BOT_TOKEN=          # Required for Telegram integration
TELEGRAM_WEBHOOK_URL=       # Required for webhook mode
TELEGRAM_WEBHOOK_SECRET=    # Optional but recommended

# APIs
WEATHER_API_KEY=            # For weather skill (OpenWeatherMap)
SEARCH_API_KEY=             # For search skill

# Logging
LOG_LEVEL=info              # debug, info, warn, error

# Server
PORT=18789
HOST=localhost
```

### Skill Development

To create a new skill:

1. Create a directory in `skills/`:
```bash
mkdir skills/my-new-skill
```

2. Create `skill.yaml`:
```yaml
name: my-new-skill
version: 1.0.0
description: Description of my skill
triggers:
  - type: keyword
    keywords:
      - trigger-word
tools:
  - my_tool_name
```

3. Create `index.ts`:
```typescript
import type { SkillModule } from '../src/types/skill';

const mySkill: SkillModule = {
  name: 'my-new-skill',
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
      handler: async (params, context) => {
        return { success: true, output: 'Result' };
      }
    }
  }
};

export default mySkill;
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run tests (`npm run typecheck`)
5. Commit your changes (`git commit -am 'Add feature'`)
6. Push to the branch (`git push origin feature/my-feature`)
7. Create a Pull Request

## 📝 License

MIT License - See [LICENSE](LICENSE) for details.

## ❓ Frequently Asked Questions

### Q: How do I get a Telegram bot token?
A: Message `@BotFather` on Telegram and send `/newbot`. Follow the instructions to create a new bot and get the token.

### Q: How do I get a Weather API key?
A: Sign up at [OpenWeatherMap](https://openweathermap.org/api) and get a free API key.

### Q: The bot doesn't respond
A: Check:
1. The bot token is correct in `.env`
2. The application is running (`npm run dev`)
3. No firewall is blocking outbound connections
4. Check logs for errors

### Q: How do I deploy this to production?
A: Use Docker or PM2. Example with PM2:
```bash
pm2 start dist/gateway/index.js --name openclaw
pm2 startup
pm2 save
```

## 📞 Support

For issues and support, please open an issue in the GitHub repository.

---

**Built with ❤️ for the OpenClaw community**
