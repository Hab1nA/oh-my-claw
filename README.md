# OpenClaw Minimal

OpenClaw Minimal is a local-first AI Agent framework built with TypeScript.

## Features

- Channel Adapter Framework (Telegram supported)
- Skills System with dynamic tool loading
- Configuration System (markdown-based)
- Heartbeat Scheduler (cron-based)
- Type-safe API design

## Project Structure

```
/workspace
├── src/
│   ├── channels/          # Channel adapters
│   ├── config/            # Configuration parsing
│   ├── heartbeat/         # Scheduler system
│   ├── tools/             # Tools & skills loader
│   ├── types/             # Type definitions
│   ├── utils/             # Utilities
│   └── index.ts
├── config/                # Configuration files
├── skills/                # Skills directory
├── examples/              # Example applications
└── package.json
```

## Quick Start

```bash
# Install dependencies
npm install

# Build
npm run build

# Type check
npm run typecheck

# Run example (requires Telegram bot token)
npm run dev
```

## Configuration

Configure your agent by editing markdown files in `config/`:

- `SOUL.md` - Core values and behavior guidelines
- `IDENTITY.md` - Agent identity and characteristics
- `USER.md` - User preferences
- `HEARTBEAT.md` - Scheduled tasks

## Skills

Skills are loaded from `skills/` directory. Each skill has:
- `skill.yaml` - Skill metadata and triggers
- `index.ts` - Skill implementation with tools

## License

MIT
