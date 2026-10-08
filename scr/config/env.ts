import fs from 'node:fs';
import path from 'node:path';

function parseEnvLine(line: string): [string, string] | null {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const equalsIndex = trimmed.indexOf('=');

  if (equalsIndex <= 0) {
    return null;
  }

  const key = trimmed.slice(0, equalsIndex).trim();
  let value = trimmed.slice(equalsIndex + 1).trim();

  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1);
  }

  return [key, value];
}

export function loadLocalEnv(): void {
  const envPath = path.resolve('.env');

  if (!fs.existsSync(envPath)) {
    return;
  }

  const contents = fs.readFileSync(envPath, 'utf8');

  for (const line of contents.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);

    if (!parsed) {
      continue;
    }

    const [key, value] = parsed;

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function getEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

export function requireEnv(name: string): string {
  const value = getEnv(name);

  if (!value) {
    throw new Error(`${name} non configurata.`);
  }

  return value;
}

export function isRemoteStorageConfigured(): boolean {
  return Boolean(
    getEnv('UPSTASH_REDIS_REST_URL') ||
      getEnv('KV_REST_API_URL')
  ) && Boolean(
    getEnv('UPSTASH_REDIS_REST_TOKEN') ||
      getEnv('KV_REST_API_TOKEN')
  );
}
