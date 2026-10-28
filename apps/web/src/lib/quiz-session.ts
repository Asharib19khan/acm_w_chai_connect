import 'server-only';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { UserError } from '@chai/db';
import { isProduction } from '@/env';

export const QUIZ_COOKIE = 'cc_quiz';

export async function quizToken(): Promise<string | undefined> {
  return (await cookies()).get(QUIZ_COOKIE)?.value;
}

export async function setQuizToken(token: string): Promise<void> {
  (await cookies()).set(QUIZ_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: 6 * 60 * 60,
  });
}

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
  return json({ error: 'Something went wrong. Try again.' }, { status: 500 });
}
