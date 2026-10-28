'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  confirmEnrolment,
  createAdmin,
  createQuiz,
  deleteQuestion,
  deleteQuiz,
  importQuestions,
  reinstate,
  reorderQuestions,
  resetAuthenticator,
  review,
  saveQuestion,
  setAdminState,
  setQuestionFlags,
  stepUp,
  updateCvSummary,
  updateQuiz,
  updateSettings,
  UserError,
  type Enrolment,
  type QuizSettings,
  type ReviewAction,
  type ReviewKind,
  type Settings,
} from '@chai/db';
import { firstIssue, quizQuestionSchema } from '@chai/core';
import { requireAdmin } from '@/lib/auth/session';
import { signOutAction } from '@/lib/auth/actions';

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; message: string };

async function run<T>(fn: () => Promise<T>, revalidate?: string): Promise<Result<T>> {
  try {
    const data = await fn();
    if (revalidate) revalidatePath(revalidate);
    return { ok: true, data };
  } catch (error) {
    if (error instanceof UserError) return { ok: false, message: error.message };
    console.error(error);
    return { ok: false, message: 'Something went wrong on our side.' };
  }
}

const kinds = z.enum(['questions', 'cvs', 'moments']);
const reasons = z.enum(['not_a_cv', 'inappropriate', 'spam', 'duplicate', 'other']);

export async function reviewAction(
  kind: ReviewKind,
  ids: string[],
  action: ReviewAction,
  reason?: string,
): Promise<Result<{ done: number; skipped: string[] }>> {
  return run(async () => {
    const actor = await requireAdmin();
    kinds.parse(kind);
    const safeIds = z.array(z.string().max(40)).max(200).parse(ids);
    const why = action === 'remove' ? reasons.parse(reason ?? 'other') : undefined;
    return review(kind, safeIds, action, actor, why);
  }, `/admin/${kind}`);
}

export async function editQuestionAction(
  id: string,
  patch: { body?: string; answered?: boolean; spotlight?: boolean },
): Promise<Result> {
  return run(async () => {
    const actor = await requireAdmin();
    const body =
      patch.body === undefined ? undefined : z.string().trim().min(10).max(300).parse(patch.body);
    await setQuestionFlags(id, { ...patch, body }, actor);
    return undefined;
  }, '/admin/questions');
}

export async function editCvSummaryAction(
  id: string,
  headline: string,
  skills: string[],
): Promise<Result> {
  return run(async () => {
    const actor = await requireAdmin();
    await updateCvSummary(
      id,
      { headline: headline.trim(), skills: skills.map((s) => s.trim()).filter(Boolean) },
      actor,
    );
    return undefined;
  }, '/admin/cvs');
}

/* ---------- settings ---------- */

export async function updateSettingsAction(patch: Partial<Settings>): Promise<Result> {
  return run(async () => {
    // The marquee and announcement are open to every admin; everything else is superadmin-only.
    const onlyMarquee = Object.keys(patch).every((k) => k === 'marquee' || k === 'announcement');
    const actor = await requireAdmin(onlyMarquee ? 'admin' : 'superadmin');
    const clean: Partial<Settings> = {};
    if (patch.marquee)
      clean.marquee = z.array(z.string().trim().min(1).max(40)).min(1).max(8).parse(patch.marquee);
    if (patch.announcement !== undefined)
      clean.announcement = patch.announcement
        ? z.string().trim().max(80).parse(patch.announcement)
        : null;
    if (patch.switches)
      clean.switches = z
        .object({
          questions: z.boolean(),
          cvs: z.boolean(),
          registration: z.boolean(),
          moments: z.boolean(),
        })
        .partial()
        .parse(patch.switches) as Settings['switches'];
    if (patch.companies)
      clean.companies = z.array(z.string().trim().min(1).max(60)).max(20).parse(patch.companies);
    if (patch.projectorMode !== undefined)
      clean.projectorMode = z.boolean().parse(patch.projectorMode);
    if (patch.moderation !== undefined) clean.moderation = z.boolean().parse(patch.moderation);
    await updateSettings(clean, actor);
    return undefined;
  }, '/admin');
}

/* ---------- admins (superadmin only) ---------- */

const STEP_UP_MS = 5 * 60_000;
const recentStepUp = new Map<string, number>();

async function requireStepUp(adminId: string, code?: string) {
  const last = recentStepUp.get(adminId) ?? 0;
  if (Date.now() - last < STEP_UP_MS) return;
  if (!code || !(await stepUp(adminId, code))) throw new UserError('STEP_UP');
  recentStepUp.set(adminId, Date.now());
}

export async function createAdminAction(input: {
  name: string;
  email: string;
  stepUpCode?: string;
}): Promise<Result<Enrolment>> {
  return run(async () => {
    const actor = await requireAdmin('superadmin');
    await requireStepUp(actor.id, input.stepUpCode);
    const data = z
      .object({ name: z.string().trim().min(2).max(60), email: z.email() })
      .safeParse(input);
    if (!data.success) throw new UserError(firstIssue(data.error));
    return createAdmin({ ...data.data, role: 'admin' }, actor);
  }, '/admin/team');
}

export async function confirmEnrolmentAction(adminId: string, code: string): Promise<Result> {
  return run(async () => {
    const actor = await requireAdmin('superadmin');
    await confirmEnrolment(adminId, code, actor);
    return undefined;
  }, '/admin/team');
}

export async function resetAuthenticatorAction(
  adminId: string,
  stepUpCode?: string,
): Promise<Result<Enrolment>> {
  return run(async () => {
    const actor = await requireAdmin('superadmin');
    await requireStepUp(actor.id, stepUpCode);
    return resetAuthenticator(adminId, actor);
  }, '/admin/team');
}

export async function adminStateAction(
  adminId: string,
  change: 'disable' | 'enable' | 'unlock' | 'revoke_sessions',
): Promise<Result> {
  return run(async () => {
    const actor = await requireAdmin('superadmin');
    await setAdminState(adminId, change, actor);
    return undefined;
  }, '/admin/team');
}

/* ---------- quiz editor ---------- */

export async function createQuizAction(
  title: string,
  from?: string,
): Promise<Result<{ id: string }>> {
  return run(async () => {
    const quiz = await createQuiz(title, await requireAdmin(), from);
    return { id: quiz.id };
  }, '/admin/quiz');
}

export async function updateQuizAction(
  id: string,
  patch: { title?: string; settings?: Partial<QuizSettings> },
): Promise<Result> {
  return run(async () => {
    await updateQuiz(id, patch, await requireAdmin());
    return undefined;
  }, '/admin/quiz');
}

export async function deleteQuizAction(id: string): Promise<Result> {
  return run(async () => {
    await deleteQuiz(id, await requireAdmin());
    return undefined;
  }, '/admin/quiz');
}

export async function saveQuestionAction(
  quizId: string,
  question: unknown,
  id?: string,
): Promise<Result> {
  return run(async () => {
    const actor = await requireAdmin();
    const parsed = quizQuestionSchema.safeParse(question);
    if (!parsed.success) throw new UserError(firstIssue(parsed.error));
    await saveQuestion(quizId, { ...parsed.data, id }, actor);
    return undefined;
  }, '/admin/quiz');
}

export async function deleteQuestionAction(quizId: string, questionId: string): Promise<Result> {
  return run(async () => {
    await deleteQuestion(quizId, questionId, await requireAdmin());
    return undefined;
  }, '/admin/quiz');
}

export async function reorderAction(quizId: string, order: string[]): Promise<Result> {
  return run(async () => {
    await reorderQuestions(quizId, order, await requireAdmin());
    return undefined;
  }, '/admin/quiz');
}

/**
 * Import from pasted CSV (question,option1..optionN,correctIndex(1-based),seconds) or a JSON array
 * of questions. Returns a row-by-row report; nothing is saved unless every row is valid.
 */
export async function importAction(
  quizId: string,
  text: string,
): Promise<Result<{ imported: number } | { errors: string[] }>> {
  return run(async () => {
    const actor = await requireAdmin();
    const rows: unknown[] = [];
    const errors: string[] = [];
    const trimmed = text.trim();
    if (trimmed.startsWith('[')) {
      try {
        rows.push(...(JSON.parse(trimmed) as unknown[]));
      } catch {
        return { errors: ['That JSON could not be read.'] };
      }
    } else {
      trimmed.split(/\r?\n/).forEach((line, i) => {
        if (!line.trim()) return;
        const cells = line.split(',').map((c) => c.trim());
        const [body, ...rest] = cells;
        const seconds = Number(rest.pop());
        const correct = Number(rest.pop());
        if (!body || rest.length < 2 || !Number.isInteger(correct)) {
          errors.push(`Line ${i + 1}: expected question, 2-6 options, correct number, seconds.`);
          return;
        }
        rows.push({
          body,
          options: rest.map((text, j) => ({ id: `o${j}`, text })),
          correctOptionId: `o${correct - 1}`,
          timeLimitS: Number.isFinite(seconds) && seconds > 0 ? seconds : 15,
          points: 1000,
        });
      });
    }
    const valid = rows.map((row, i) => {
      const parsed = quizQuestionSchema.safeParse(row);
      if (!parsed.success) errors.push(`Row ${i + 1}: ${firstIssue(parsed.error)}`);
      return parsed.success ? parsed.data : null;
    });
    if (errors.length > 0 || valid.length === 0)
      return { errors: errors.length ? errors : ['Nothing to import.'] };
    const imported = await importQuestions(
      quizId,
      valid.filter((v) => v !== null),
      actor,
    );
    return { imported };
  }, '/admin/quiz');
}

export async function reinstateAction(sessionId: string): Promise<Result> {
  return run(async () => {
    await reinstate(sessionId, await requireAdmin());
    return undefined;
  }, '/admin/quiz');
}

export async function adminSignOutAction(): Promise<void> {
  await signOutAction();
}
