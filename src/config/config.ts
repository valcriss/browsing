import fs from 'fs';
import path from 'path';
import type { AppConfig, UserConfig } from '../types/index.d.ts';

let cachedConfig: AppConfig | null = null;

export function validateConfig(obj: unknown): AppConfig {
  if (!obj || typeof obj !== 'object') throw new Error('Invalid configuration');
  const cfg = obj as Partial<AppConfig>;
  if (!cfg.root || typeof cfg.root !== 'string')
    throw new Error('root must be string');
  if (!path.isAbsolute(cfg.root)) throw new Error('root must be absolute');
  if (!Array.isArray(cfg.users)) throw new Error('users must be array');
  cfg.users.forEach((u: unknown) => {
    const user = u as Partial<UserConfig>;
    if (!user.username || typeof user.username !== 'string')
      throw new Error('user.username required');
    if (!user.passwordHash || typeof user.passwordHash !== 'string')
      throw new Error('user.passwordHash required');
    if (user.role !== 'admin' && user.role !== 'user')
      throw new Error('user.role invalid');
  });
  if (!cfg.auth || typeof cfg.auth !== 'object')
    throw new Error('auth required');
  if (!cfg.auth.jwtSecret || typeof cfg.auth.jwtSecret !== 'string')
    throw new Error('jwtSecret required');
  if (
    cfg.auth.tokenTtlMinutes === undefined ||
    typeof cfg.auth.tokenTtlMinutes !== 'number' ||
    !Number.isFinite(cfg.auth.tokenTtlMinutes) ||
    cfg.auth.tokenTtlMinutes <= 0
  )
    throw new Error('tokenTtlMinutes must be positive number');

  return cfg as AppConfig;
}

export function loadConfig(): AppConfig {
  if (cachedConfig) return cachedConfig;
  const file = path.resolve(process.cwd(), 'configuration.json');
  const raw = fs.readFileSync(file, 'utf-8');
  const parsed = JSON.parse(raw);
  cachedConfig = validateConfig(parsed);
  return cachedConfig;
}

// testing helper
export function __setConfigForTests(cfg: AppConfig | null): void {
  cachedConfig = cfg;
}
