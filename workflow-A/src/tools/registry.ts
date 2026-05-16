import { resolve } from 'node:path';
import type { ToolRegistryContract } from './registry.interface.js';
import type {
  ToolDefinition,
  ToolExecutionContext,
  ToolFilter,
  ToolRegistryOptions,
  ToolResult
} from './types.js';

export class ToolRegistry implements ToolRegistryContract {
  private readonly tools = new Map<string, ToolDefinition>();
  private readonly allowedPaths: string[];

  constructor(private readonly options: ToolRegistryOptions) {
    this.allowedPaths = options.allowedPaths.map((item) => resolve(item));
  }

  registerTool(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  unregisterTool(name: string): boolean {
    return this.tools.delete(name);
  }

  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  listTools(filter?: ToolFilter): ToolDefinition[] {
    const tools = [...this.tools.values()];
    if (!filter) return tools;
    return tools.filter((tool) => {
      if (filter.category && tool.category !== filter.category) return false;
      if (filter.tags?.length && !filter.tags.every((tag) => tool.tags?.includes(tag))) return false;
      if (filter.searchText) {
        const haystack = `${tool.name} ${tool.description}`.toLowerCase();
        if (!haystack.includes(filter.searchText.toLowerCase())) return false;
      }
      return true;
    });
  }

  async executeTool(
    name: string,
    params: Record<string, unknown>,
    context?: Partial<ToolExecutionContext>
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, error: `Tool not found: ${name}` };
    }

    const validation = validateParams(tool, params);
    if (validation) {
      return { success: false, error: validation };
    }

    const fullContext: ToolExecutionContext = {
      sessionId: context?.sessionId ?? 'default',
      userId: context?.userId ?? 'anonymous',
      workingDirectory: context?.workingDirectory ?? process.cwd(),
      environment: {
        ...(context?.environment ?? {}),
        ALLOWED_PATHS: this.allowedPaths.join(';'),
        BLOCKED_COMMANDS: this.options.blockedCommands.join(';')
      },
      toolCallId: context?.toolCallId
    };

    return withTimeout(tool.handler(params, fullContext), this.options.timeout, name);
  }
}

function validateParams(tool: ToolDefinition, params: Record<string, unknown>): string | undefined {
  for (const required of tool.parameters.required ?? []) {
    if (!(required in params)) {
      return `Missing required parameter: ${required}`;
    }
  }

  for (const [name, value] of Object.entries(params)) {
    const schema = tool.parameters.properties[name];
    if (!schema || value === undefined || value === null) continue;
    if (!matchesType(value, schema.type)) {
      return `Invalid parameter type for ${name}: expected ${schema.type}`;
    }
    if (schema.enum && !schema.enum.includes(value)) {
      return `Invalid parameter value for ${name}`;
    }
  }

  return undefined;
}

function matchesType(value: unknown, type: string): boolean {
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return typeof value === 'object' && !Array.isArray(value);
  return typeof value === type;
}

async function withTimeout(
  promise: Promise<ToolResult>,
  timeout: number,
  toolName: string
): Promise<ToolResult> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<ToolResult>((resolve) => {
    timer = setTimeout(() => {
      resolve({ success: false, error: `Tool timed out: ${toolName}` });
    }, timeout);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

