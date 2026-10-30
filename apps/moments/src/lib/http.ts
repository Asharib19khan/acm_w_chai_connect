import 'server-only';
import { NextResponse } from 'next/server';
import { DriveError } from './drive';

/** A problem the person can fix; its message is shown as is. */
export class UserError extends Error {}

/** Route handlers accept only same-origin requests (CSRF guard for JSON endpoints). */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return request.headers.get('sec-fetch-site') === 'same-origin';
  return origin === new URL(request.url).origin;
}

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: { 'Cache-Control': 'no-store', ...init?.headers },
  });
}

export function jsonError(error: unknown) {
  if (error instanceof UserError) return json({ error: error.message }, { status: 400 });
  console.error(error);
  if (error instanceof DriveError)
    return json(
      { error: 'Uploads are having trouble right now. Try again in a minute.' },
      { status: 503 },
    );
  return json({ error: 'Something went wrong. Try again.' }, { status: 500 });
}
