export function env(name: string, source: NodeJS.ProcessEnv = process.env): string | undefined {
  const value = source[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export function envFlag(name: string, defaultValue = false, source: NodeJS.ProcessEnv = process.env): boolean {
  const value = env(name, source);
  if (!value) {
    return defaultValue;
  }
  return ["1", "true", "yes", "on", "enabled"].includes(value.toLowerCase());
}

export function envNumber(name: string, defaultValue: number, source: NodeJS.ProcessEnv = process.env): number {
  const value = env(name, source);
  if (!value) {
    return defaultValue;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}
