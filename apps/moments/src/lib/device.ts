import 'server-only';
import { cookies, headers } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { hmac, serverKey } from './keys';
import { isProduction } from '@/env';

/*
 * Per-device identity (blueprint section 6): a random ID in a signed, HttpOnly cookie that lasts
 * 400 days. The client mirrors the same ID to localStorage/IndexedDB and sends it back if the cookie
 * was cleared. Only an HMAC of the ID is stored in the database.
 */
const COOKIE = 'cc_device';
const MAX_AGE = 400 * 24 * 60 * 60;

function sign(id: string): string {
  return hmac(serverKey('DEVICE_TOKEN_KEY'), `device:${id}`).slice(0, 32);
}

function parse(value: string | undefined): string | null {
  if (!value) return null;
  const [id, sig] = value.split('.');
  if (!id || !sig || !/^[A-Za-z0-9_-]{16,40}$/.test(id)) return null;
  return sign(id) === sig ? id : null;
}

/** Reads the device ID without creating one (safe in Server Components). */
export async function peekDevice(): Promise<{ id: string; hash: string } | null> {
  const id = parse((await cookies()).get(COOKIE)?.value);
  return id ? { id, hash: deviceHash(id) } : null;
}

export function deviceHash(id: string): string {
  return hmac(serverKey('DEVICE_TOKEN_KEY'), `devicehash:${id}`);
}

/**
 * Returns the device ID, creating and setting the cookie if needed. Call only from Server Actions
 * or Route Handlers. `mirrored` is the signed value the client kept in localStorage.
 */
export async function ensureDevice(
  mirrored?: string | null,
): Promise<{ id: string; hash: string; token: string }> {
  const store = await cookies();
  let id = parse(store.get(COOKIE)?.value) ?? parse(mirrored ?? undefined);
  if (!id) id = randomBytes(16).toString('base64url');
  const token = `${id}.${sign(id)}`;
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
  return { id, hash: deviceHash(id), token };
}

/** HMAC of the caller's IP for rate limits; the raw IP is never stored. */
export async function ipHash(): Promise<string> {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'local';
  return hmac(serverKey('IP_HASH_KEY'), `ip:${ip}`);
}
