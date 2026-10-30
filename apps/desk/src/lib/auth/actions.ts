'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { hmac, serverKey, signIn, signOut } from '@chai/db';
import { clearSessionCookie, sessionToken, setSessionCookie } from './session';

/*
 * Same sign-in as the admin portal (email + Authenticator code, lockouts, equal timing), but the
 * session is created for the desk only. Recovery codes are superadmin-only and live on the admin
 * portal, so they are not accepted here.
 */
const attempts = new Map<string, number[]>();

async function ipKey() {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  return hmac(serverKey('IP_HASH_KEY'), `desk-ip:${ip}`);
}

function tooMany(key: string): boolean {
  const t = Date.now();
  const list = (attempts.get(key) ?? []).filter((at) => t - at < 15 * 60_000);
  list.push(t);
  attempts.set(key, list);
  return list.length > 10;
}

const input = z.object({ email: z.email().max(120), code: z.string().regex(/^\d{6}$/) });
const GENERIC = "Couldn't sign you in";

export async function deskSignInAction(raw: {
  email: string;
  code: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const started = Date.now();
  const finish = async <T>(value: T): Promise<T> => {
    const wait = 700 - (Date.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    return value;
  };
  const parsed = input.safeParse(raw);
  if (!parsed.success) return finish({ ok: false as const, message: GENERIC });
  if (tooMany(await ipKey()))
    return finish({ ok: false as const, message: 'Too many attempts. Wait 15 minutes.' });
  const userAgent = (await headers()).get('user-agent');
  const result = await signIn(parsed.data.email, parsed.data.code, userAgent, 'desk');
  if (!result.ok) return finish({ ok: false as const, message: GENERIC });
  await setSessionCookie(result.token);
  return finish({ ok: true as const });
}

export async function deskSignOutAction(): Promise<void> {
  await signOut(await sessionToken());
  await clearSessionCookie();
}
