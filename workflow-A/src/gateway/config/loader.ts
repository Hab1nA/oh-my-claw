import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { GatewayConfig } from './types.js';

const DEFAULT_CONFIG: GatewayConfig = {
  port: 18789,
  host: '127.0.0.1',
  logLevel: 'info',
  agent: {
    model: 'deepseek-chat',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com',
    maxTokens: 2048,
    temperature: 0.2,
    maxIterations: 6
  },
  tools: {
    timeout: 30000,
    allowedPaths: ['./workspace'],
    blockedCommands: ['rm -rf /', 'dd', 'mkfs', 'format', 'shutdown', 'curl|sh', 'wget|sh']
  },
  memory: {
    storagePath: './data/sessions',
    maxHistoryLength: 40
  }
};

export function loadConfig(configPath = process.env.OPENCLAW_CONFIG): GatewayConfig {
  const resolvedPath = resolveConfigPath(configPath);
  const fileConfig = resolvedPath ? readConfigFile(resolvedPath) : {};
  const config = mergeConfig(DEFAULT_CONFIG, fileConfig);
  applyEnvOverrides(config);
  validateConfig(config);
  return config;
}

function resolveConfigPath(configPath?: string): string | undefined {
  const candidates = [
    configPath,
    'config.json',
    'config.yaml',
    'config.yml',
    'config.example.json'
  ].filter(Boolean) as string[];

  return candidates.map((item) => resolve(item)).find((item) => existsSync(item));
}

function readConfigFile(filePath: string): Partial<GatewayConfig> {
  const raw = readFileSync(filePath, 'utf-8');
  const expanded = expandEnv(raw);
  if (filePath.endsWith('.json')) {
    return JSON.parse(expanded) as Partial<GatewayConfig>;
  }
  return parseSimpleYaml(expanded) as Partial<GatewayConfig>;
}

function expandEnv(input: string): string {
  return input.replace(/\$\{([A-Z0-9_]+)\}/g, (_, name: string) => process.env[name] ?? '');
}

function mergeConfig(base: GatewayConfig, override: Partial<GatewayConfig>): GatewayConfig {
  return {
    ...base,
    ...override,
    agent: { ...base.agent, ...(override.agent ?? {}) },
    tools: { ...base.tools, ...(override.tools ?? {}) },
    memory: { ...base.memory, ...(override.memory ?? {}) }
  };
}

function applyEnvOverrides(config: GatewayConfig): void {
  if (process.env.OPENCLAW_PORT) config.port = Number(process.env.OPENCLAW_PORT);
  if (process.env.OPENCLAW_HOST) config.host = process.env.OPENCLAW_HOST;
  if (process.env.OPENCLAW_LOG_LEVEL) {
    config.logLevel = process.env.OPENCLAW_LOG_LEVEL as GatewayConfig['logLevel'];
  }
  if (process.env.OPENCLAW_API_KEY) config.agent.apiKey = process.env.OPENCLAW_API_KEY;
  if (process.env.OPENCLAW_BASE_URL) config.agent.baseUrl = process.env.OPENCLAW_BASE_URL;
  if (process.env.OPENCLAW_MODEL) config.agent.model = process.env.OPENCLAW_MODEL;
}

function validateConfig(config: GatewayConfig): void {
  if (!Number.isInteger(config.port) || config.port <= 0) {
    throw new Error('Invalid gateway port');
  }
  if (!['debug', 'info', 'warn', 'error'].includes(config.logLevel)) {
    throw new Error(`Invalid logLevel: ${config.logLevel}`);
  }
  if (config.memory.maxHistoryLength < 4) {
    throw new Error('memory.maxHistoryLength must be >= 4');
  }
  if (!Array.isArray(config.tools.allowedPaths) || config.tools.allowedPaths.length === 0) {
    throw new Error('tools.allowedPaths must contain at least one path');
  }
}

function parseSimpleYaml(raw: string): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  const stack: Array<{ indent: number; value: Record<string, unknown> }> = [{ indent: -1, value: root }];
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    const trimmed = line.trim();
    const match = trimmed.match(/^([^:]+):\s*(.*)$/);
    if (!match) continue;

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const key = match[1].trim();
    const valueText = match[2].trim();
    const parent = stack[stack.length - 1].value;

    if (valueText === '') {
      const child: Record<string, unknown> = {};
      parent[key] = child;
      stack.push({ indent, value: child });
    } else {
      parent[key] = parseYamlScalar(valueText);
    }
  }

  return root;
}

function parseYamlScalar(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
  }
  return value.replace(/^['"]|['"]$/g, '');
}

