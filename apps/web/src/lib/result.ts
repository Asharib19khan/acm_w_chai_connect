import { UserError } from '@chai/db';

export type ActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; message: string; fields?: Record<string, string> };

export const SLOW_DOWN = 'Too many tries from here. Wait a minute and try again.';

/** Turns expected errors into a message; logs and hides unexpected ones. */
export function fail(error: unknown): {
  ok: false;
  message: string;
  fields?: Record<string, string>;
} {
  if (error instanceof UserError) {
    return {
      ok: false,
      message: error.message,
      fields: error.field ? { [error.field]: error.message } : undefined,
    };
  }
  console.error(error);
  return { ok: false, message: 'Something went wrong on our side. Try again in a moment.' };
}
