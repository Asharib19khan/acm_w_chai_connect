import 'server-only';
import { checkQuestion } from '@chai/ai';
import { newId } from '../crypto';
import { mutate, now, read, UserError } from '../store';
import type { Question } from '../types';
import { writeAudit } from './audit';
import { newModeration } from './moderation';

export async function hasAsked(deviceHash: string): Promise<boolean> {
  return (await read()).questions.some((q) => q.deviceHash === deviceHash);
}

export async function createQuestion(input: {
  body: string;
  showName: boolean;
  displayName: string | null;
  deviceHash: string;
  src: string | null;
}): Promise<Question> {
  return mutate((db) => {
    if (!db.settings.switches.questions) throw new UserError('Questions are closed right now.');
    // unique(device_hash): one question per device, enforced inside the locked write.
    if (db.questions.some((q) => q.deviceHash === input.deviceHash)) {
      throw new UserError("You've already asked your question from this device.");
    }
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
    db.questions.push(question);
    return question;
  });
}

export async function listQuestions(): Promise<Question[]> {
  return [...(await read()).questions].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function setQuestionFlags(
  id: string,
  patch: { answered?: boolean; spotlight?: boolean; body?: string },
  actor: { id: string; name: string },
): Promise<void> {
  await mutate((db) => {
    const q = db.questions.find((item) => item.id === id);
    if (!q) throw new UserError('That question no longer exists.');
    if (patch.answered !== undefined) q.answered = patch.answered;
    if (patch.spotlight !== undefined) {
      for (const other of db.questions) other.spotlightAt = null;
      q.spotlightAt = patch.spotlight ? now() : null;
    }
    if (patch.body !== undefined) {
      writeAudit(db, actor, 'questions.edit', 'questions', id, `was: ${q.body}`);
      q.body = patch.body;
    } else {
      writeAudit(db, actor, 'questions.update', 'questions', id, JSON.stringify(patch));
    }
  });
}
