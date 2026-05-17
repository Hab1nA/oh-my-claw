import { realpathSync } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

export function isPathAllowed(path: string, allowedPathsText: string | undefined): boolean {
  const resolvedTarget = resolve(path);
  const allowedPaths = (allowedPathsText ?? '')
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => resolve(item));

  if (allowedPaths.length === 0) return true;

  try {
    const realTarget = realpathSync(resolvedTarget);
    return allowedPaths.some((allowed) => {
      try {
        const realAllowed = realpathSync(allowed);
        return realTarget === realAllowed || realTarget.startsWith(realAllowed + sep);
      } catch {
        return resolvedTarget === allowed || resolvedTarget.startsWith(allowed + sep);
      }
    });
  } catch {
    return allowedPaths.some((allowed) => resolvedTarget === allowed || resolvedTarget.startsWith(allowed + sep));
  }
}

export async function isPathAllowedAsync(path: string, allowedPathsText: string | undefined): Promise<boolean> {
  const resolvedTarget = resolve(path);
  const allowedPaths = (allowedPathsText ?? '')
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => resolve(item));

  if (allowedPaths.length === 0) return true;

  let realTarget: string;
  try {
    realTarget = await realpath(resolvedTarget);
  } catch {
    realTarget = resolvedTarget;
  }

  for (const allowed of allowedPaths) {
    let realAllowed: string;
    try {
      realAllowed = await realpath(allowed);
    } catch {
      realAllowed = allowed;
    }
    if (realTarget === realAllowed || realTarget.startsWith(realAllowed + sep)) {
      return true;
    }
  }
  return false;
}
