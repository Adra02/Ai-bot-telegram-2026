import fs from 'node:fs';
import path from 'node:path';
import { getEnv, isRemoteStorageConfigured } from '../config/env.js';

const localStoreDirectory = path.resolve('data/store');

function ensureLocalStoreDirectory(): void {
  if (!fs.existsSync(localStoreDirectory)) {
    fs.mkdirSync(localStoreDirectory, { recursive: true });
  }
}

function localKeyPath(key: string): string {
  const safeKey = key.replace(/[^a-zA-Z0-9._-]/g, '_');
  return path.join(localStoreDirectory, `${safeKey}.json`);
}

function getRedisConfig(): { url: string; token: string } | null {
  const url =
    getEnv('UPSTASH_REDIS_REST_URL') ||
    getEnv('KV_REST_API_URL');

  const token =
    getEnv('UPSTASH_REDIS_REST_TOKEN') ||
    getEnv('KV_REST_API_TOKEN');

  if (!url || !token) {
    return null;
  }

  return { url, token };
}

async function redisCommand<T>(command: unknown[]): Promise<T> {
  const config = getRedisConfig();

  if (!config) {
    throw new Error(
      'Storage Redis non configurato. Collega Upstash Redis in Vercel oppure usa lo storage locale.'
    );
  }

  const response = await fetch(config.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Redis HTTP ${response.status}: ${body}`);
  }

  const result = (await response.json()) as { result: T };
  return result.result;
}

export async function getValue<T>(key: string): Promise<T | null> {
  if (!isRemoteStorageConfigured()) {
    ensureLocalStoreDirectory();
    const filePath = localKeyPath(key);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as T;
  }

  const result = await redisCommand<string | null>(['GET', key]);

  if (result === null) {
    return null;
  }

  return JSON.parse(result) as T;
}

export async function setValue<T>(
  key: string,
  value: T
): Promise<void> {
  if (!isRemoteStorageConfigured()) {
    ensureLocalStoreDirectory();
    fs.writeFileSync(
      localKeyPath(key),
      JSON.stringify(value, null, 2),
      'utf8'
    );
    return;
  }

  await redisCommand(['SET', key, JSON.stringify(value)]);
}

export async function deleteValue(key: string): Promise<void> {
  if (!isRemoteStorageConfigured()) {
    ensureLocalStoreDirectory();
    const filePath = localKeyPath(key);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return;
  }

  await redisCommand(['DEL', key]);
}
