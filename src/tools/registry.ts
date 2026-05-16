import { resolve } from 'node:path';
import type {
  ToolDefinition,
  ToolExecutionContext,
  ToolFilter,
  ToolRegistryOptions,
  ToolResult
} from '../types/tool.js';
import { logger } from '../utils/logger.js';

export interface ToolRegistryContract {
  registerTool(tool: ToolDefinition): void;
  unregisterTool(name: string): boolean;
  getTool(name: string): ToolDefinition | undefined;
  hasTool(name: string): boolean;
  listTools(filter?: ToolFilter): ToolDefinition[];
  executeTool(
    name: string,
    params: Record<string, unknown>,
    context?: Partial<ToolExecutionContext>
  ): Promise<ToolResult>;
}

const DEFAULT_OPTIONS: ToolRegistryOptions = {
  timeout: 30000,
  allowedPaths: ['./workspace'],
  blockedCommands: ['rm -rf /', 'dd', 'mkfs', 'format', 'shutdown', 'curl|sh', 'wget|sh']
};

export class ToolRegistry implements ToolRegistryContract {
  private readonly tools = new Map<string, ToolDefinition>();
  private readonly categories = new Map<string, Set<string>>();
  private readonly tags = new Map<string, Set<string>>();
  private readonly allowedPaths: string[];
  private readonly options: ToolRegistryOptions;

  constructor(options?: Partial<ToolRegistryOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.allowedPaths = this.options.allowedPaths.map((item) => resolve(item));
  }

  registerTool(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      logger.warn(`Tool already registered, overwriting: ${tool.name}`);
    }

    this.tools.set(tool.name, tool);

    if (tool.category) {
      if (!this.categories.has(tool.category)) {
        this.categories.set(tool.category, new Set());
      }
      this.categories.get(tool.category)!.add(tool.name);
    }

    if (tool.tags) {
      for (const tag of tool.tags) {
        if (!this.tags.has(tag)) {
          this.tags.set(tag, new Set());
        }
        this.tags.get(tag)!.add(tool.name);
      }
    }

    logger.debug(`Tool registered: ${tool.name}`, {
      category: tool.category,
      tags: tool.tags
    });
  }

  unregisterTool(name: string): boolean {
    const tool = this.tools.get(name);
    if (!tool) return false;

    this.tools.delete(name);

    if (tool.category) {
      this.categories.get(tool.category)?.delete(name);
    }

    if (tool.tags) {
      for (const tag of tool.tags) {
        this.tags.get(tag)?.delete(name);
      }
    }

    logger.debug(`Tool unregistered: ${name}`);
    return true;
  }

  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  listTools(filter?: ToolFilter): ToolDefinition[] {
    if (!filter) return Array.from(this.tools.values());

    let toolNames: Set<string> | null = null;

    if (filter.category) {
      const categoryTools = this.categories.get(filter.category);
      if (!categoryTools) return [];
      toolNames = new Set(categoryTools);
    }

    if (filter.tags && filter.tags.length > 0) {
      const tagTools = new Set<string>();
      for (const tag of filter.tags) {
        const toolsForTag = this.tags.get(tag);
        if (toolsForTag) {
          for (const name of toolsForTag) {
            tagTools.add(name);
          }
        }
      }

      if (toolNames) {
        toolNames = new Set([...toolNames].filter(name => tagTools.has(name)));
      } else {
        toolNames = tagTools;
      }
    }

    let results: ToolDefinition[];
    if (toolNames) {
      results = [...toolNames]
        .map(name => this.tools.get(name))
        .filter((t): t is ToolDefinition => t !== undefined);
    } else {
      results = Array.from(this.tools.values());
    }

    if (filter.searchText) {
      const searchLower = filter.searchText.toLowerCase();
      results = results.filter(tool =>
        tool.name.toLowerCase().includes(searchLower) ||
        tool.description.toLowerCase().includes(searchLower)
      );
    }

    return results;
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

    const validationError = validateParams(tool, params);
    if (validationError) {
      return { success: false, error: validationError };
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

    logger.debug(`Executing tool: ${name}`, { params });

    const result = await withTimeout(
      tool.handler(params, fullContext),
      this.options.timeout,
      name
    );

    logger.debug(`Tool execution completed: ${name}`, {
      success: result.success,
      hasOutput: !!result.output,
      hasError: !!result.error
    });

    return result;
  }

  getToolCount(): number {
    return this.tools.size;
  }

  getCategories(): string[] {
    return Array.from(this.categories.keys());
  }

  getTags(): string[] {
    return Array.from(this.tags.keys());
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
