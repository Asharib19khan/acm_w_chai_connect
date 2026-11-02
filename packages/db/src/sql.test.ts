import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type * as DbModule from './index';

let db: typeof DbModule;
beforeAll(async () => {
  db = await import('./index');
});
beforeEach(async () => {
  await db.resetStore();
});

const actor = { id: 'test', name: 'Test' };

describe('postgres layer', () => {
  it('keeps keys inside json exactly as stored, and returns ISO timestamps', async () => {
    const { sql } = await import('./sql');
    const s = sql();
    const [r] = await s`select ${s.json({ qq_ab_c: ['o_1'] } as never)}::jsonb as option_orders, now() as created_at`;
    expect(Object.keys((r as { optionOrders: object }).optionOrders)).toEqual(['qq_ab_c']);
    expect((r as { createdAt: string }).createdAt).toMatch(/^\d{4}-\d\d-\d\dT.*Z$/);
  });

  it('handles a crowd joining and answering at the same moment', async () => {
    const quiz = await db.createQuiz('Load', actor);
    await db.importQuestions(
      quiz.id,
      [1, 2].map((n) => ({
        body: `Q${n}`,
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
        ],
        correctOptionId: 'b',
        timeLimitS: 20,
        points: 1000,
      })),
      actor,
    );
    await db.setPhase('unlock', actor, quiz.id);
    const players = Array.from({ length: 40 }, (_, i) => ({
      rollNo: `25K-${String(1000 + i)}`,
      department: 'CS' as const,
      deviceHash: `dev${i}`,
    }));
    const tokens = (await Promise.all(players.map((p) => db.joinQuiz(p)))).map((r) => r.token);
    await db.setPhase('start', actor);
    const { sql } = await import('./sql');
    await sql()`update quiz_control set starts_at = ${new Date(Date.now() - 1).toISOString()}`;

    for (let round = 0; round < 2; round++) {
      const served = await Promise.all(tokens.map((t) => db.nextQuestion(t)));
      const results = await Promise.all(
        served.map((n, i) => {
          if (n.kind !== 'question') throw new Error(`expected a question, got ${n.kind}`);
          // Options are keyed by question id: every player must get both options back.
          expect(n.question.options.map((o) => o.id).sort()).toEqual(['a', 'b']);
          return db.answerQuestion(tokens[i], n.question.id, i % 2 ? 'b' : 'a');
        }),
      );
      expect(results.every((r) => r.locked)).toBe(true);
    }
    const board = await db.quizBoard(50);
    expect(board.joined).toBe(40);
    expect(board.rows).toHaveLength(40);
    expect(board.rows.filter((r) => r.correctCount === 2)).toHaveLength(20);
    expect(board.rows.every((r) => r.answered === 2)).toBe(true);
  });

  it('never double-registers under parallel requests for one roll number', async () => {
    const games = await db.listGames();
    const mini = games.filter((g) => g.category === 'mini').map((g) => g.id);
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) =>
        db.register({ rollNo: '25K-9999', department: 'CS', gameIds: [mini[i % mini.length]!] }),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await db.listRegistrations()).filter((r) => r.rollNo === '25K-9999')).toHaveLength(1);
  });
});
