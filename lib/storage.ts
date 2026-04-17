import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data');

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

export interface Friend {
  id: number;
  name: string;
  handle: string;
  active: boolean;
}

export interface Settings {
  schedule: { enabled: boolean; time: string };
  friends: Friend[];
  message: string;
}

export interface LogEntry {
  id: number;
  ts: number;
  ok: boolean;
  sent: number;
  total: number;
  detail?: string;
}

export const DEFAULT_SETTINGS: Settings = {
  schedule: { enabled: false, time: '09:00' },
  friends: [],
  message: '🐿️🐿️🐿️',
};

export function readJson<T>(file: string, fallback: T): T {
  ensureDir();
  const path = join(DATA_DIR, file);
  if (!existsSync(path)) return fallback;
  try { return JSON.parse(readFileSync(path, 'utf-8')); }
  catch { return fallback; }
}

export function writeJson(file: string, data: unknown) {
  ensureDir();
  writeFileSync(join(DATA_DIR, file), JSON.stringify(data, null, 2));
}
