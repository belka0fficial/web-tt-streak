import { createHmac, randomBytes } from 'crypto';
import { readJson, writeJson } from './storage';

interface AuthConfig { passwordHash: string; secret: string; }

function cfg(): AuthConfig | null {
  return readJson<AuthConfig | null>('auth.json', null);
}

function hash(password: string, secret: string) {
  return createHmac('sha256', secret).update(password).digest('hex');
}

function mintToken(): string {
  const token = randomBytes(32).toString('hex');
  const tokens = readJson<string[]>('tokens.json', []);
  writeJson('tokens.json', [...tokens, token]);
  return token;
}

export function isSetupDone(): boolean { return cfg() !== null; }

export function setup(password: string): string {
  const secret = randomBytes(32).toString('hex');
  writeJson('auth.json', { passwordHash: hash(password, secret), secret });
  return mintToken();
}

export function login(password: string): string | null {
  const c = cfg();
  if (!c) return null;
  if (hash(password, c.secret) !== c.passwordHash) return null;
  return mintToken();
}

export function verifyToken(token: string | null | undefined): boolean {
  if (!token) return false;
  return readJson<string[]>('tokens.json', []).includes(token);
}

export function requireAuth(req: Request): Response | null {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!verifyToken(token)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  return null;
}
