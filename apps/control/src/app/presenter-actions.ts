'use server';

import { setPhase, setQuestionFlags, UserError } from '@chai/db';
import { requireAdmin } from '@/lib/auth/session';

type Result = { ok: true } | { ok: false; message: string };

async function run(fn: () => Promise<unknown>): Promise<Result> {
  try {
    await fn();
    return { ok: true };
  } catch (error) {
    if (error instanceof UserError) return { ok: false, message: error.message };
    console.error(error);
    return { ok: false, message: 'Something went wrong.' };
  }
}

export async function quizControlAction(
  action: 'unlock' | 'start' | 'end' | 'lock',
  quizId?: string,
): Promise<Result> {
  return run(async () => setPhase(action, await requireAdmin(), quizId));
}

export async function spotlightAction(id: string, on: boolean): Promise<Result> {
  return run(async () => setQuestionFlags(id, { spotlight: on }, await requireAdmin()));
}

export async function answeredAction(id: string, answered: boolean): Promise<Result> {
  return run(async () =>
    setQuestionFlags(id, { answered, spotlight: false }, await requireAdmin()),
  );
}
