import type { ToolDefinition, ToolExecutionContext, ToolFilter, ToolResult } from '../types/tool.js';

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
