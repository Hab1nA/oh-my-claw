import type { ToolExecutionContext, ToolDefinition, ToolResult } from '../types.js';
import { Logger } from '../../gateway/utils/logger.js';

const logger = Logger.getInstance();

const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '169.254.169.254',
  'metadata.google.internal'
];

function isUrlSafe(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return !BLOCKED_HOSTS.some((blocked) => hostname === blocked || hostname.endsWith('.' + blocked));
  } catch {
    return false;
  }
}

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
  handler: async (params, context: Partial<ToolExecutionContext>): Promise<ToolResult> => {
    const url = String(params.url);

    if (!isUrlSafe(url)) {
      logger.warn('HTTP request blocked: SSRF protection', {
        url,
        sessionId: context?.sessionId,
        userId: context?.userId
      });
      return { success: false, error: `Request to this URL is blocked by SSRF protection: ${url}` };
    }

    logger.info('HTTP request initiated', {
      url,
      method: String(params.method ?? 'GET'),
      sessionId: context?.sessionId,
      userId: context?.userId
    });

    const controller = new AbortController();
    const timeout = typeof params.timeout === 'number' ? params.timeout : 30000;
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: String(params.method ?? 'GET'),
        headers: asHeaders(params.headers),
        body: typeof params.body === 'string' ? params.body : undefined,
        signal: controller.signal
      });
      const body = await response.text();
      logger.info('HTTP request completed', {
        url,
        status: response.status,
        sessionId: context?.sessionId
      });
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
      logger.warn('HTTP request failed', {
        url,
        error: String(error),
        sessionId: context?.sessionId
      });
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
