import type { ToolDefinition, ToolExecutionContext, ToolFilter, ToolResult } from './types.js';

export interface ToolRegistryContract {
  registerTool(tool: ToolDefinition): void;
  unregisterTool(name: string): boolean;
  getTool(name: string): ToolDefinition | undefined;
  listTools(filter?: ToolFilter): ToolDefinition[];
  executeTool(
    name: string,
    params: Record<string, unknown>,
    context?: Partial<ToolExecutionContext>
  ): Promise<ToolResult>;
}

