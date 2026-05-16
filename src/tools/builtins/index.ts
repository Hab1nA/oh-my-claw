import type { ToolRegistryContract } from '../registry.js';
import { fileReadTool } from './file-read.js';
import { fileWriteTool } from './file-write.js';
import { httpRequestTool } from './http.js';
import { shellTool } from './shell.js';

export function registerBuiltInTools(registry: ToolRegistryContract): void {
  registry.registerTool(fileReadTool);
  registry.registerTool(fileWriteTool);
  registry.registerTool(shellTool);
  registry.registerTool(httpRequestTool);
}
