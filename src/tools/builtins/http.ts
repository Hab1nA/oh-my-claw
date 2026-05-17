import type { ToolExecutionContext, ToolDefinition, ToolResult } from '../../types/tool.js';
import { logger } from '../../utils/logger.js';

const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '169.254.169.254',
  'metadata.google.internal'
];

const PRIVATE_IP_PATTERNS: Array<{ test: (ip: string) => boolean }> = [
  { test: (ip) => ip === '0.0.0.0' },
  { test: (ip) => /^(10\.|127\.)/.test(ip) },
  { test: (ip) => /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) },
  { test: (ip) => /^192\.168\./.test(ip) },
  { test: (ip) => /^169\.254\./.test(ip) },
  { test: (ip) => /^fc00:/i.test(ip) },
  { test: (ip) => /^fe80:/i.test(ip) },
  { test: (ip) => /^::1$/i.test(ip) },
  { test: (ip) => /^0+:*:?0*$/.test(ip) },
];

function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_PATTERNS.some((p) => p.test(ip));
}

function isUrlSafe(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    if (!parsed.protocol || !['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    if (BLOCKED_HOSTS.some((blocked) => hostname === blocked || hostname.endsWith('.' + blocked))) {
      return false;
    }

    if (isPrivateIp(hostname)) {
      return false;
    }

    return true;
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
