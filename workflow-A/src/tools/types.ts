export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
  handler: ToolHandler;
  category?: string;
  tags?: string[];
}

export interface ToolParameterSchema {
  type: 'object';
  properties: Record<string, ParameterDefinition>;
  required?: string[];
}

export interface ParameterDefinition {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  default?: unknown;
  enum?: unknown[];
}

export type ToolHandler = (
  params: Record<string, unknown>,
  context: ToolExecutionContext
) => Promise<ToolResult>;

export interface ToolExecutionContext {
  sessionId: string;
  userId: string;
  workingDirectory: string;
  environment: Record<string, string>;
  toolCallId?: string;
}

export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolFilter {
  category?: string;
  tags?: string[];
  searchText?: string;
}

export interface ToolRegistryOptions {
  timeout: number;
  allowedPaths: string[];
  blockedCommands: string[];
}

