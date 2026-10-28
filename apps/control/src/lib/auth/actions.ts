'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { hmac, serverKey, signIn, signInWithRecovery, signOut } from '@chai/db';
import { clearSessionCookie, sessionToken, setSessionCookie } from './session';

/*
 * Sign-in order (blueprint section 5): Turnstile (production) → IP rate limit → account checks →
 * TOTP with replay block → lockouts → session. Every failure returns the same message after the
 * same delay.
 */
const attempts = new Map<string, number[]>();

async function ipKey() {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  return hmac(serverKey('IP_HASH_KEY'), `ip:${ip}`);
}

function tooMany(key: string): boolean {
  const t = Date.now();
  const list = (attempts.get(key) ?? []).filter((at) => t - at < 15 * 60_000);
  list.push(t);
  attempts.set(key, list);
  return list.length > 10;
}

const input = z.object({
  email: z.email().max(120),
  code: z.string().regex(/^\d{6}$|^[A-Z0-9]{10}$/i),
});

const GENERIC = "Couldn't sign you in";

export async function signInAction(raw: {
  email: string;
  code: string;
}): Promise<{ ok: true; name: string } | { ok: false; message: string }> {
  const started = Date.now();
  const finish = async <T>(value: T): Promise<T> => {
    // Equal response time for every outcome.
    const wait = 700 - (Date.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    return value;
  };
  const parsed = input.safeParse(raw);
  if (!parsed.success) return finish({ ok: false as const, message: GENERIC });
  if (tooMany(await ipKey()))
    return finish({ ok: false as const, message: 'Too many attempts. Wait 15 minutes.' });
  const userAgent = (await headers()).get('user-agent');
  let token: string;
  let name = 'Superadmin';
  if (/^\d{6}$/.test(parsed.data.code)) {
    const result = await signIn(parsed.data.email, parsed.data.code, userAgent);
    if (!result.ok) return finish({ ok: false as const, message: GENERIC });
    token = result.token;
    name = result.admin.name;
  } else {
    const result = await signInWithRecovery(parsed.data.email, parsed.data.code, userAgent);
    if (!result.ok) return finish({ ok: false as const, message: GENERIC });
    token = result.token;
  }
  await setSessionCookie(token);
  return finish({ ok: true as const, name });
}

export async function signOutAction(): Promise<void> {
  await signOut(await sessionToken());
  await clearSessionCookie();
}
