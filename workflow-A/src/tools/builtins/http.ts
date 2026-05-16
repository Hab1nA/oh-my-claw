import type { ToolDefinition } from '../types.js';

export const httpRequestTool: ToolDefinition = {
  name: 'http_request',
  description: 'Send HTTP requests to external APIs',
  category: 'network',
  tags: ['http', 'request', 'api'],
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'The URL to send the request to' },
      method: {
        type: 'string',
        description: 'HTTP method',
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        default: 'GET'
      },
      headers: { type: 'object', description: 'HTTP headers' },
      body: { type: 'string', description: 'Request body' },
      timeout: { type: 'number', description: 'Request timeout in milliseconds', default: 30000 }
    },
    required: ['url']
  },
  handler: async (params) => {
    const controller = new AbortController();
    const timeout = typeof params.timeout === 'number' ? params.timeout : 30000;
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(String(params.url), {
        method: String(params.method ?? 'GET'),
        headers: asHeaders(params.headers),
        body: typeof params.body === 'string' ? params.body : undefined,
        signal: controller.signal
      });
      const body = await response.text();
      return {
        success: true,
        output: JSON.stringify(
          {
            status: response.status,
            headers: Object.fromEntries(response.headers.entries()),
            body
          },
          null,
          2
        )
      };
    } catch (error) {
      return { success: false, error: String(error) };
    } finally {
      clearTimeout(timer);
    }
  }
};

function asHeaders(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, string>;
}
