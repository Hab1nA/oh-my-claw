import { readFile } from 'node:fs/promises';
import type { ToolDefinition } from '../../types/tool.js';
import { isPathAllowed } from './path-policy.js';

export const fileReadTool: ToolDefinition = {
  name: 'file_read',
  description: 'Read the contents of a file from the local filesystem',
  category: 'filesystem',
  tags: ['file', 'read', 'io'],
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'The absolute or allowed relative path to the file' },
      encoding: { type: 'string', description: 'The file encoding', default: 'utf-8' },
      maxLines: { type: 'number', description: 'Maximum number of lines to read' },
      offset: { type: 'number', description: 'Line offset to start reading from', default: 0 }
    },
    required: ['path']
  },
  handler: async (params, context) => {
    const path = String(params.path);
    const encoding = String(params.encoding ?? 'utf-8') as BufferEncoding;
    const maxLines = typeof params.maxLines === 'number' ? params.maxLines : undefined;
    const offset = typeof params.offset === 'number' ? params.offset : 0;

    if (!isPathAllowed(path, context.environment.ALLOWED_PATHS)) {
      return { success: false, error: 'Path not allowed' };
    }

    try {
      const content = await readFile(path, encoding);
      const lines = content.split(/\r?\n/);
      const output =
        maxLines === undefined ? content : lines.slice(offset, offset + maxLines).join('\n');
      return { success: true, output, metadata: { path, encoding } };
    } catch (error) {
      return { success: false, error: String(error), metadata: { path } };
    }
  }
};
