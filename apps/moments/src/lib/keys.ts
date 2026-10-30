import 'server-only';
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { env } from '@/env';

/*
 * Server keys for the moments site, from environment variables only (32 random bytes, base64).
 * `pnpm drive:connect` writes fresh ones to apps/moments/.env.local; Vercel holds the real ones.
 * This site keeps no files and no database, so it never writes keys to disk.
 */
type KeyName = 'DEVICE_TOKEN_KEY' | 'IP_HASH_KEY' | 'MOMENTS_TICKET_KEY';

export function serverKey(name: KeyName): Buffer {
  const value = env[name];
  if (!value) throw new Error(`${name} is not set. Run pnpm drive:connect.`);
  const key = Buffer.from(value, 'base64');
  if (key.length < 32) throw new Error(`${name} must be 32 bytes, base64.`);
  return key;
}

export function hmac(key: Buffer, value: string): string {
  return createHmac('sha256', key).update(value).digest('hex');
}

/** AES-256-GCM, URL-safe. Used for upload tickets so the Drive session URL never leaves us. */
export function seal(key: Buffer, data: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key.subarray(0, 32), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}

export function open<T>(key: Buffer, token: string): T | null {
  try {
    const raw = Buffer.from(token, 'base64url');
    if (raw.length < 29) return null;
    const decipher = createDecipheriv('aes-256-gcm', key.subarray(0, 32), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const plain = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]);
    return JSON.parse(plain.toString('utf8')) as T;
  } catch {
    return null;
  }
}
