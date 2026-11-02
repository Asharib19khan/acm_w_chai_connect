import 'server-only';
import { checkQuestion } from '@chai/ai';
import { newId } from '../crypto';
import { isUnique, sql, tx } from '../sql';
import { bump, now, ready, UserError } from '../store';
import type { Question } from '../types';
import { writeAudit } from './audit';
import { newModeration } from './moderation';
import { getSettings } from './settings';

export async function hasAsked(deviceHash: string): Promise<boolean> {
  await ready();
  const rows = await sql()`select 1 from questions where device_hash = ${deviceHash} limit 1`;
  return rows.length > 0;
}

export async function createQuestion(input: {
  body: string;
  showName: boolean;
  displayName: string | null;
  deviceHash: string;
  src: string | null;
}): Promise<Question> {
  await ready();
  if (!(await getSettings()).switches.questions)
    throw new UserError('Questions are closed right now.');
  const rule = checkQuestion(input.body, input.displayName);
  const question: Question = {
    id: newId('q'),
    body: input.body,
    showName: input.showName,
    displayName: input.showName ? input.displayName : null,
    deviceHash: input.deviceHash,
    src: input.src,
    answered: false,
    spotlightAt: null,
    createdAt: now(),
    ...newModeration(rule),
  };
  try {
    await tx(async (t) => {
      await t`insert into questions ${t(question as never)}`;
      await bump(t);
    });
  } catch (error) {
    // unique(device_hash): one question per device.
    if (isUnique(error)) throw new UserError("You've already asked your question from this device.");
    throw error;
  }
  return question;
}

export async function listQuestions(): Promise<Question[]> {
  await ready();
  return sql()<Question[]>`select * from questions order by created_at`;
}

export async function setQuestionFlags(
  id: string,
  patch: { answered?: boolean; spotlight?: boolean; body?: string },
  actor: { id: string; name: string },
): Promise<void> {
  await ready();
  await tx(async (t) => {
    const [q] = await t<Question[]>`select * from questions where id = ${id} for update`;
    if (!q) throw new UserError('That question no longer exists.');
    if (patch.answered !== undefined)
      await t`update questions set answered = ${patch.answered} where id = ${id}`;
    if (patch.spotlight !== undefined) {
      await t`update questions set spotlight_at = null where spotlight_at is not null`;
      if (patch.spotlight) await t`update questions set spotlight_at = ${now()} where id = ${id}`;
    }
    if (patch.body !== undefined) {
      await writeAudit(t, actor, 'questions.edit', 'questions', id, `was: ${q.body}`);
      await t`update questions set body = ${patch.body} where id = ${id}`;
    } else {
      await writeAudit(t, actor, 'questions.update', 'questions', id, JSON.stringify(patch));
    }
    await bump(t);
  });
}
