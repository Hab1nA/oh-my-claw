import type { ToolDefinition, ToolFilter, ToolResult, ToolExecutionContext } from '../types/index.js';
import { logger, ToolExecutionError } from '../utils/index.js';

export interface ToolRegistry {
  registerTool(tool: ToolDefinition): void;
  unregisterTool(name: string): boolean;
  getTool(name: string): ToolDefinition | undefined;
  listTools(filter?: ToolFilter): ToolDefinition[];
  executeTool(name: string, params: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult>;
  hasTool(name: string): boolean;
}

export class ToolRegistryImpl implements ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private categories: Map<string, Set<string>> = new Map();
  private tags: Map<string, Set<string>> = new Map();

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
    if (!tool) {
      return false;
    }

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

  listTools(filter?: ToolFilter): ToolDefinition[] {
    if (!filter) {
      return Array.from(this.tools.values());
    }

    let toolNames: Set<string> | null = null;

    if (filter.category) {
      const categoryTools = this.categories.get(filter.category);
      if (!categoryTools) {
        return [];
      }
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
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new ToolExecutionError(name, new Error(`Tool not found: ${name}`));
    }

    try {
      this.validateParameters(tool, params);

      logger.debug(`Executing tool: ${name}`, { params });

      const result = await tool.handler(params, context);

      logger.debug(`Tool execution completed: ${name}`, {
        success: result.success,
        hasOutput: !!result.output,
        hasError: !!result.error
      });

      return result;
    } catch (error) {
      if (error instanceof ToolExecutionError) {
        throw error;
      }

      logger.error(`Tool execution failed: ${name}`, {
        error: (error as Error).message
      });

      throw new ToolExecutionError(name, error as Error);
    }
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  private validateParameters(tool: ToolDefinition, params: Record<string, unknown>): void {
    const schema = tool.parameters;
    const required = schema.required ?? [];

    for (const reqParam of required) {
      if (params[reqParam] === undefined) {
        throw new ToolExecutionError(
          tool.name,
          new Error(`Missing required parameter: ${reqParam}`)
        );
      }
    }

    for (const [paramName, paramValue] of Object.entries(params)) {
      const paramDef = schema.properties[paramName];
      if (!paramDef) {
        continue;
      }

      this.validateParameterType(tool.name, paramName, paramDef.type, paramValue);

      if (paramDef.enum && !paramDef.enum.includes(paramValue)) {
        throw new ToolExecutionError(
          tool.name,
          new Error(`Parameter ${paramName} must be one of: ${paramDef.enum.join(', ')}`)
        );
      }
    }
  }

  private validateParameterType(
    toolName: string,
    paramName: string,
    expectedType: string,
    value: unknown
  ): void {
    const actualType = Array.isArray(value) ? 'array' : typeof value;

    if (expectedType === 'object' && actualType !== 'object') {
      throw new ToolExecutionError(
        toolName,
        new Error(`Parameter ${paramName} must be an object, got ${actualType}`)
      );
    }

    if (expectedType !== 'object' && expectedType !== actualType) {
      throw new ToolExecutionError(
        toolName,
        new Error(`Parameter ${paramName} must be ${expectedType}, got ${actualType}`)
      );
    }
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
