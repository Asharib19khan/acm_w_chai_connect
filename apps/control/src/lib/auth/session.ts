import 'server-only';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { sessionFromToken, UserError, type AdminRole, type SessionInfo } from '@chai/db';
import { isProduction } from '@/env';

// __Host- prefix in production (Secure, path=/, no Domain). Plain name on http://localhost.
export const ADMIN_COOKIE = isProduction ? '__Host-cc_admin' : 'cc_admin';

export async function sessionToken(): Promise<string | undefined> {
  return (await cookies()).get(ADMIN_COOKIE)?.value;
}

export async function getSession(): Promise<SessionInfo | null> {
  return sessionFromToken(await sessionToken());
}

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: 12 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
}

export interface Actor {
  id: string;
  name: string;
  role: AdminRole;
}

/**
 * Every admin server action and route handler starts here (CLAUDE.md rule 4). Never rely on
 * proxy.ts for access control.
 */
export async function requireAdmin(role: AdminRole = 'admin'): Promise<Actor> {
  const info = await getSession();
  if (!info) throw new UserError('Your session ended. Sign in again.');
  if (role === 'superadmin' && info.admin.role !== 'superadmin')
    throw new UserError('Only the superadmin can do that.');
  return { id: info.admin.id, name: info.admin.name, role: info.admin.role };
}

/** For pages: anyone without a session sees the normal 404, so the portals stay invisible. */
export async function requireAdminPage(role: AdminRole = 'admin'): Promise<SessionInfo> {
  const info = await getSession();
  if (!info) notFound();
  if (role === 'superadmin' && info.admin.role !== 'superadmin') notFound();
  return info;
}
