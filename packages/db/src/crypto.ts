import 'server-only';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
} from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dbEnv } from './env';
import { DATA_DIR } from './store';

/*
 * Keys come from environment variables. In local development, when a key is missing, a random one
 * is generated once into .data/dev-keys.json (gitignored). Vercel deploys refuse to build without
 * the real variables (env.ts), so this fallback never runs in production.
 */
type KeyName = 'IP_HASH_KEY' | 'DEVICE_TOKEN_KEY' | 'TOTP_ENCRYPTION_KEY' | 'SESSION_HMAC_KEY';

export function serverKey(name: KeyName): Buffer {
  const fromEnv = dbEnv[name];
  if (fromEnv) return Buffer.from(fromEnv, 'base64');
  const file = join(DATA_DIR, 'dev-keys.json');
  mkdirSync(DATA_DIR, { recursive: true });
  const keys = existsSync(file)
    ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>)
    : {};
  if (!keys[name]) {
    keys[name] = randomBytes(32).toString('base64');
    writeFileSync(file, JSON.stringify(keys, null, 2));
  }
  return Buffer.from(keys[name], 'base64');
}

export function hmac(key: Buffer, value: string): string {
  return createHmac('sha256', key).update(value).digest('hex');
}

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(9).toString('base64url')}`;
}

/** Human-friendly code without look-alike characters, e.g. CC-7F3K2. */
export function confirmationCode(): string {
  const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  let out = '';
  for (let i = 0; i < 5; i++) out += alphabet[randomInt(alphabet.length)];
  return `CC-${out}`;
}

export function sixDigits(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function encrypt(key: Buffer, plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}

export function decrypt(key: Buffer, payload: string): string {
  const [iv, tag, data] = payload.split('.').map((part) => Buffer.from(part, 'base64'));
  if (!iv || !tag || !data) throw new Error('Malformed ciphertext');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
