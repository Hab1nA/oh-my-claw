import { resolve } from 'node:path';

export function isPathAllowed(path: string, allowedPathsText: string | undefined): boolean {
  const target = resolve(path);
  const allowedPaths = (allowedPathsText ?? '')
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => resolve(item));

  return allowedPaths.some((allowed) => target === allowed || target.startsWith(allowed + '\\') || target.startsWith(allowed + '/'));
}

