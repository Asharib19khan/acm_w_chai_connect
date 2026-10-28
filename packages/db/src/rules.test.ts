import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Point the dev store at a throwaway folder before the module loads.
process.env.CHAI_DATA_DIR = mkdtempSync(join(tmpdir(), 'chai-test-'));

import type * as DbModule from './index';

let db: typeof DbModule;

beforeAll(async () => {
  db = await import('./index');
});
beforeEach(async () => {
  await db.resetStore();
});

const actor = { id: 'test', name: 'Test' };
const game = async (slug: string) => (await db.listGames()).find((g) => g.slug === slug)!.id;

describe('two-games rule', () => {
  it('allows one physical and one minigame', async () => {
    const r = await db.register({
      rollNo: '25K-5570',
      department: 'CS',
      gameIds: [await game('hide-and-seek'), await game('fast-type')],
    });
    expect(r.games).toHaveLength(2);
  });

  it('refuses a second physical game, even later', async () => {
    await db.register({
      rollNo: '25K-5570',
      department: 'CS',
      gameIds: [await game('hide-and-seek')],
    });
    await expect(
      db.register({
        rollNo: '25K-5570',
        department: 'CS',
        gameIds: [await game('campus-impostor')],
      }),
    ).rejects.toThrow(/already in Hide & Seek/);
  });

  it('refuses two of the same category in one request', async () => {
    await expect(
      db.register({
        rollNo: '25K-5570',
        department: 'CS',
        gameIds: [await game('chai-rush'), await game('fast-type')],
      }),
    ).rejects.toThrow(/one minigame at most|one physical game/);
  });

  it('holds under parallel requests', async () => {
    const [a, b] = [await game('hide-and-seek'), await game('human-bingo')];
    const results = await Promise.allSettled([
      db.register({ rollNo: '24K-0001', department: 'EE', gameIds: [a] }),
      db.register({ rollNo: '24K-0001', department: 'EE', gameIds: [b] }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('frees the category after a withdrawal', async () => {
    await db.register({
      rollNo: '25K-5570',
      department: 'CS',
      gameIds: [await game('hide-and-seek')],
    });
    const reg = (await db.listRegistrations())[0]!;
    await db.actOnRegistration(reg.id, { type: 'withdraw' }, actor);
    await expect(
      db.register({
        rollNo: '25K-5570',
        department: 'CS',
        gameIds: [await game('campus-impostor')],
      }),
    ).resolves.toBeTruthy();
  });
});

describe('questions', () => {
  it('allows one question per device', async () => {
    await db.createQuestion({
      body: 'How do internships work here?',
      showName: false,
      displayName: null,
      deviceHash: 'd1',
      src: null,
    });
    await expect(
      db.createQuestion({
        body: 'And another question please?',
        showName: false,
        displayName: null,
        deviceHash: 'd1',
        src: null,
      }),
    ).rejects.toThrow(/already asked/);
  });

  it('never deletes: removed items can be restored', async () => {
    const q = await db.createQuestion({
      body: 'Is this restorable later on?',
      showName: false,
      displayName: null,
      deviceHash: 'd2',
      src: null,
    });
    await db.review('questions', [q.id], 'remove', actor, 'spam');
    await db.review('questions', [q.id], 'restore', actor);
    expect((await db.listQuestions())[0]!.status).toBe('scanned');
  });

  it('blocks a double approval', async () => {
    const q = await db.createQuestion({
      body: 'Two admins approve at once?',
      showName: false,
      displayName: null,
      deviceHash: 'd3',
      src: null,
    });
    await db.review('questions', [q.id], 'approve', actor);
    await expect(
      db.review('questions', [q.id], 'approve', { id: 'x', name: 'Other' }),
    ).rejects.toThrow(/Already reviewed/);
  });
});

describe('scores', () => {
  it('voids instead of editing, and the total follows', async () => {
    await db.register({
      rollNo: '25K-5570',
      department: 'CS',
      gameIds: [await game('hide-and-seek')],
    });
    const reg = (await db.listRegistrations())[0]!;
    await db.addScore(reg.id, 60, 'Catch', actor);
    await db.addScore(reg.id, 20, 'Catch', actor);
    const [first] = await db.listScoreEvents(reg.id);
    await db.voidScore(first!.id, 'Entered twice', actor);
    expect((await db.listRegistrations())[0]!.total).toBe(60);
  });
});

describe('quiz', () => {
  it('never sends the correct option and refuses re-answers', async () => {
    const quiz = await db.createQuiz('Test', actor);
    await db.importQuestions(
      quiz.id,
      [
        {
          body: 'Two plus two?',
          options: [
            { id: 'a', text: '3' },
            { id: 'b', text: '4' },
          ],
          correctOptionId: 'b',
          timeLimitS: 15,
          points: 1000,
        },
      ],
      actor,
    );
    await db.setPhase('unlock', actor, quiz.id);
    const { token } = await db.joinQuiz({
      rollNo: '25K-5570',
      department: 'CS',
      deviceHash: 'dev',
    });
    await expect(
      db.joinQuiz({ rollNo: '25K-5570', department: 'CS', deviceHash: 'dev2' }),
    ).rejects.toThrow(/already joined/);
    await db.setPhase('start', actor);
    // Skip the 5 s countdown in the test.
    const { mutate } = await import('./store');
    await mutate((d) => {
      d.quizControl.startsAt = new Date(Date.now() - 1).toISOString();
    });
    const next = await db.nextQuestion(token);
    expect(next.kind).toBe('question');
    if (next.kind !== 'question') return;
    expect(JSON.stringify(next.question)).not.toContain('correct');
    const answered = await db.answerQuestion(token, next.question.id, 'b');
    expect(answered.locked).toBe(true);
    const again = await db.answerQuestion(token, next.question.id, 'a');
    expect(again.locked).toBe(false);
    const board = await db.quizBoard();
    expect(board.rows[0]!.correctCount).toBe(1);
  });
});

describe('admin auth', () => {
  it('locks after 5 wrong codes and gives one message for everything', async () => {
    await db.bootstrapSuperadmin('Ye');
    for (let i = 0; i < 5; i++) {
      const r = await db.signIn('asharib2khan@gmail.com', '000000', null);
      expect(r).toEqual({ ok: false, message: "Couldn't sign you in" });
    }
    const unknown = await db.signIn('nobody@example.com', '123456', null);
    expect(unknown).toEqual({ ok: false, message: "Couldn't sign you in" });
    const admin = (await db.listAdmins())[0]!;
    expect(admin.lockedUntil).not.toBeNull();
  });
});
