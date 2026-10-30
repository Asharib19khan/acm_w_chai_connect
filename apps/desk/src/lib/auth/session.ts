import 'server-only';
import { cookies } from 'next/headers';
import { sessionFromToken, UserError, type SessionInfo } from '@chai/db';
import { isProduction } from '@/env';

// Its own cookie: a desk session is never sent to, or accepted by, the admin portal.
export const DESK_COOKIE = isProduction ? '__Host-cc_desk' : 'cc_desk';

export async function sessionToken(): Promise<string | undefined> {
  return (await cookies()).get(DESK_COOKIE)?.value;
}

export async function getSession(): Promise<SessionInfo | null> {
  return sessionFromToken(await sessionToken(), 'desk');
}

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(DESK_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: 12 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(DESK_COOKIE);
}

export interface Actor {
  id: string;
  name: string;
}

/** Every desk server action and route handler starts here. Never rely on proxy.ts. */
export async function requireDesk(): Promise<Actor> {
  const info = await getSession();
  if (!info) throw new UserError('Your session ended. Sign in again.');
  return { id: info.admin.id, name: info.admin.name };
}
