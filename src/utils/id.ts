export function randomId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function filterEnvVars(env: Record<string, string | undefined>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}
