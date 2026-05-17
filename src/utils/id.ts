import { randomUUID } from 'node:crypto';

export function randomId(): string {
  return randomUUID();
}

const SENSITIVE_ENV_PATTERNS = [
  /SECRET/i,
  /PASSWORD/i,
  /TOKEN/i,
  /API_KEY/i,
  /PRIVATE_KEY/i,
  /ACCESS_KEY/i,
  /AUTH/i,
  /CREDENTIAL/i,
];

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_ENV_PATTERNS.some((pattern) => pattern.test(key));
}

export function filterEnvVars(env: Record<string, string | undefined>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined && !isSensitiveKey(key)) {
      result[key] = value;
    }
  }
  return result;
}
