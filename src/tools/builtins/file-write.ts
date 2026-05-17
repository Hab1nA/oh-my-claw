import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ToolDefinition } from '../../types/tool.js';
import { isPathAllowed } from './path-policy.js';

export const fileWriteTool: ToolDefinition = {
  name: 'file_write',
  description: 'Write content to a file in the local filesystem',
  category: 'filesystem',
  tags: ['file', 'write', 'io'],
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'The absolute or allowed relative path to the file' },
      content: { type: 'string', description: 'The content to write to the file' },
      createDirectories: { type: 'boolean', description: 'Create parent directories', default: true },
      backup: { type: 'boolean', description: 'Create a backup before writing', default: false }
    },
    required: ['path', 'content']
  },
  handler: async (params, context) => {
    const path = String(params.path);
    const content = String(params.content);
    const createDirectories = params.createDirectories !== false;
    const backup = params.backup === true;

    if (!isPathAllowed(path, context.environment.ALLOWED_PATHS)) {
      return { success: false, error: 'Path not allowed' };
    }

    try {
      if (createDirectories) {
        await mkdir(dirname(path), { recursive: true });
      }
      if (backup && (await fileExists(path))) {
        await copyFile(path, `${path}.${Date.now()}.bak`);
      }
      await writeFile(path, content, 'utf-8');
      return { success: true, output: `File written successfully: ${path}`, metadata: { path } };
    } catch (error) {
      return { success: false, error: String(error), metadata: { path } };
    }
  }
};

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
