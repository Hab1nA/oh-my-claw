import { exec } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import type { ToolDefinition } from '../../types/tool.js';
import { isPathAllowed } from './path-policy.js';

const execAsync = promisify(exec);

export const shellTool: ToolDefinition = {
  name: 'shell',
  description: 'Execute shell commands in a restricted terminal environment',
  category: 'system',
  tags: ['shell', 'command', 'exec'],
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The shell command to execute' },
      timeout: { type: 'number', description: 'Maximum execution time in milliseconds', default: 30000 },
      cwd: { type: 'string', description: 'Working directory for command execution' }
    },
    required: ['command']
  },
  handler: async (params, context) => {
    const command = String(params.command);
    const timeout = typeof params.timeout === 'number' ? params.timeout : 30000;
    const cwd = resolve(String(params.cwd ?? context.workingDirectory));

    if (isDangerousCommand(command, context.environment.BLOCKED_COMMANDS)) {
      return { success: false, error: 'Command blocked for security reasons' };
    }

    if (!isPathAllowed(cwd, context.environment.ALLOWED_PATHS)) {
      return { success: false, error: 'Working directory not allowed' };
    }

    try {
      const result = await execAsync(command, {
        cwd,
        timeout,
        windowsHide: true,
        env: context.environment
      });
      return {
        success: true,
        output: result.stdout,
        error: result.stderr,
        metadata: { cwd, timeout, exitCode: 0 }
      };
    } catch (error) {
      const execError = error as { stdout?: string; stderr?: string; code?: number; message?: string };
      return {
        success: false,
        output: execError.stdout,
        error: execError.stderr || execError.message || String(error),
        metadata: { cwd, timeout, exitCode: execError.code }
      };
    }
  }
};

export function isDangerousCommand(command: string, blockedCommandsText = ''): boolean {
  const normalized = command.trim().toLowerCase();
  const configured = blockedCommandsText
    .split(';')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const dangerousPatterns = [
    /^rm\s+-rf\s+\//,
    /\bdd\b/,
    /\bmkfs\b/,
    /\bformat\b/,
    /\bshutdown\b/,
    /curl\s+.*\|\s*(sh|bash|powershell|pwsh)/,
    /wget\s+.*\|\s*(sh|bash|powershell|pwsh)/,
    />\s*\/dev\/sd[a-z]/,
    /\bdel\s+\/f\s+\/s\s+\/q\s+[a-z]:\\/i
  ];

  return configured.some((item) => normalized.includes(item)) || dangerousPatterns.some((pattern) => pattern.test(normalized));
}
