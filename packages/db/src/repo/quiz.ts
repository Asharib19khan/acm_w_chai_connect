import 'server-only';
import { randomInt } from 'node:crypto';
import { quizPoints, rankQuiz, type DepartmentCode } from '@chai/core';
import { hmac, newId, randomToken, serverKey } from '../crypto';
import { isUnique, sql, tx, type Tx } from '../sql';
import { bump, now, ready, UserError } from '../store';
import type {
  Quiz,
  QuizControl,
  QuizPhase,
  QuizQuestion,
  QuizSession,
  QuizSettings,
} from '../types';
import { writeAudit } from './audit';

type Actor = { id: string; name: string };

/** Grace for network delay on answers (blueprint section 11). */
const ANSWER_GRACE_MS = 1500;
const COUNTDOWN_MS = 5000;
/** The offline sweep runs at most this often, across every server instance. */
const SWEEP_MS = Number(process.env.QUIZ_SWEEP_MS ?? 1500);

const DEFAULT_SETTINGS: QuizSettings = {
  shuffleQuestions: true,
  shuffleOptions: true,
  dqOnLeave: true,
  offlineSeconds: 15,
  revealAfterEnd: true,
};

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function tokenHash(token: string): string {
  return hmac(serverKey('SESSION_HMAC_KEY'), `quiz:${token}`);
}

/* ---------- reads ---------- */

type ControlRow = QuizControl & { sweptAt: string | null };

async function control(t: Tx, lock: '' | 'share' | 'update' = ''): Promise<ControlRow> {
  const [c] = await t<ControlRow[]>`
    select quiz_id, phase, starts_at, ended_at, updated_by, swept_at from quiz_control where id = 1
    ${lock === 'update' ? t`for update` : lock === 'share' ? t`for share` : t``}`;
  return c ?? { quizId: null, phase: 'locked', startsAt: null, endedAt: null, updatedBy: null, sweptAt: null };
}

async function quizById(t: Tx, id: string | null | undefined, lock = false): Promise<Quiz | null> {
  if (!id) return null;
  const [q] = await t<Quiz[]>`select * from quizzes where id = ${id} ${lock ? t`for update` : t``}`;
  return q ?? null;
}

async function saveQuiz(t: Tx, q: Quiz): Promise<void> {
  await t`
    update quizzes set title = ${q.title}, settings = ${t.json(q.settings as never)},
      questions = ${t.json(q.questions as never)}, ran_at = ${q.ranAt}
    where id = ${q.id}`;
}

async function saveSession(t: Tx, s: QuizSession): Promise<void> {
  await t`
    update quiz_sessions set status = ${s.status}, dq_reason = ${s.dqReason},
      current_index = ${s.currentIndex}, served_at = ${s.servedAt},
      last_heartbeat_at = ${s.lastHeartbeatAt}, answers = ${t.json(s.answers as never)},
      score = ${s.score}, correct_count = ${s.correctCount}, correct_ms = ${s.correctMs}
    where id = ${s.id}`;
}

/* ---------- editor ---------- */

export async function listQuizzes(): Promise<Quiz[]> {
  await ready();
  return sql()<Quiz[]>`select * from quizzes order by created_at`;
}

export async function getQuiz(id: string): Promise<Quiz | null> {
  await ready();
  return quizById(sql(), id);
}

async function assertEditable(t: Tx, quizId: string) {
  const c = await control(t, 'share');
  if (c.quizId === quizId && (c.phase === 'open' || c.phase === 'countdown' || c.phase === 'live')) {
    throw new UserError('This quiz is open or live. Lock it before editing.');
  }
}

export async function createQuiz(title: string, actor: Actor, from?: string): Promise<Quiz> {
  await ready();
  return tx(async (t) => {
    const source = from ? await quizById(t, from) : null;
    const quiz: Quiz = {
      id: newId('quiz'),
      title: title.trim().slice(0, 80) || 'Untitled quiz',
      settings: source ? { ...source.settings } : { ...DEFAULT_SETTINGS },
      questions: source ? source.questions.map((q) => ({ ...q, id: newId('qq') })) : [],
      ranAt: null,
      createdAt: now(),
    };
    await t`
      insert into quizzes (id, title, settings, questions, ran_at, created_at)
      values (${quiz.id}, ${quiz.title}, ${t.json(quiz.settings as never)},
        ${t.json(quiz.questions as never)}, null, ${quiz.createdAt})`;
    await writeAudit(t, actor, from ? 'quiz.duplicate' : 'quiz.create', 'quizzes', quiz.id, quiz.title);
    await bump(t);
    return quiz;
  });
}

/** Loads a quiz for editing (locked), runs edit, saves it and writes the audit row. */
async function editQuiz<T>(
  quizId: string,
  actor: Actor,
  action: string,
  detail: string | null,
  edit: (quiz: Quiz) => T,
): Promise<T> {
  await ready();
  return tx(async (t) => {
    const quiz = await quizById(t, quizId, true);
    if (!quiz) throw new UserError('Quiz not found.');
    await assertEditable(t, quizId);
    const result = edit(quiz);
    await saveQuiz(t, quiz);
    await writeAudit(t, actor, action, 'quizzes', quizId, detail);
    await bump(t);
    return result;
  });
}

export async function updateQuiz(
  id: string,
  patch: { title?: string; settings?: Partial<QuizSettings> },
  actor: Actor,
): Promise<void> {
  await editQuiz(id, actor, 'quiz.update', Object.keys(patch).join(', '), (quiz) => {
    if (patch.title !== undefined) quiz.title = patch.title.trim().slice(0, 80) || quiz.title;
    if (patch.settings) quiz.settings = { ...quiz.settings, ...patch.settings };
  });
}

export async function deleteQuiz(id: string, actor: Actor): Promise<void> {
  await ready();
  await tx(async (t) => {
    const quiz = await quizById(t, id, true);
    if (!quiz) return;
    if (quiz.ranAt) throw new UserError('This quiz has already run, so it is kept for the record.');
    await assertEditable(t, id);
    await t`delete from quizzes where id = ${id}`;
    await t`update quiz_control set quiz_id = null where id = 1 and quiz_id = ${id}`;
    await writeAudit(t, actor, 'quiz.delete', 'quizzes', id, quiz.title);
    await bump(t);
  });
}

export async function saveQuestion(
  quizId: string,
  question: Omit<QuizQuestion, 'id'> & { id?: string },
  actor: Actor,
): Promise<void> {
  await editQuiz(quizId, actor, 'quiz.question_save', question.body.slice(0, 60), (quiz) => {
    if (question.id) {
      const index = quiz.questions.findIndex((q) => q.id === question.id);
      if (index === -1) throw new UserError('Question not found.');
      quiz.questions[index] = { ...question, id: question.id };
    } else {
      quiz.questions.push({ ...question, id: newId('qq') });
    }
  });
}

export async function deleteQuestion(
  quizId: string,
  questionId: string,
  actor: Actor,
): Promise<void> {
  await editQuiz(quizId, actor, 'quiz.question_delete', questionId, (quiz) => {
    quiz.questions = quiz.questions.filter((q) => q.id !== questionId);
  });
}

export async function reorderQuestions(
  quizId: string,
  order: string[],
  actor: Actor,
): Promise<void> {
  await editQuiz(quizId, actor, 'quiz.reorder', null, (quiz) => {
    const byId = new Map(quiz.questions.map((q) => [q.id, q]));
    const next = order.map((id) => byId.get(id)).filter((q): q is QuizQuestion => Boolean(q));
    if (next.length !== quiz.questions.length)
      throw new UserError('Reorder failed. Refresh and try again.');
    quiz.questions = next;
  });
}

export async function importQuestions(
  quizId: string,
  questions: Omit<QuizQuestion, 'id'>[],
  actor: Actor,
): Promise<number> {
  return editQuiz(quizId, actor, 'quiz.import', `${questions.length} questions`, (quiz) => {
    for (const q of questions) quiz.questions.push({ ...q, id: newId('qq') });
    return questions.length;
  });
}

/* ---------- phase machine ---------- */

function totalWindowMs(quiz: Quiz): number {
  return quiz.questions.reduce((sum, q) => sum + q.timeLimitS * 1000 + ANSWER_GRACE_MS, 0) + 10_000;
}

/**
 * Applies time-based transitions (countdown → live → ended) and disqualifies players who went
 * offline. Runs in its own short statements, never inside a player's transaction, and the sweep is
 * claimed by one server at a time, so thousands of answers never queue behind it.
 */
async function advanceClock(): Promise<void> {
  const s = sql();
  const c = await control(s);
  if (!c.quizId || !c.startsAt || (c.phase !== 'countdown' && c.phase !== 'live')) return;
  const t = Date.now();
  if (c.phase === 'countdown') {
    if (t < Date.parse(c.startsAt)) return;
    const moved = await s`update quiz_control set phase = 'live' where id = 1 and phase = 'countdown' returning id`;
    if (moved.length) await bump(s);
  }
  const claimed = await s`
    update quiz_control set swept_at = ${now()}
    where id = 1 and phase = 'live'
      and (swept_at is null or swept_at <= ${new Date(t - SWEEP_MS).toISOString()})
    returning id`;
  if (claimed.length === 0) return;
  const quiz = await quizById(s, c.quizId);
  if (!quiz) return;
  if (quiz.settings.offlineSeconds > 0) {
    const cutoff = new Date(t - quiz.settings.offlineSeconds * 1000).toISOString();
    const dq = await s`
      update quiz_sessions set status = 'disqualified', dq_reason = 'Went offline'
      where quiz_id = ${quiz.id} and status = 'active' and last_heartbeat_at < ${cutoff}
      returning id`;
    if (dq.length) await bump(s);
  }
  const [n] = await s<{ joined: number; active: number }[]>`
    select count(*)::int as joined, count(*) filter (where status = 'active')::int as active
    from quiz_sessions where quiz_id = ${quiz.id}`;
  if ((n!.joined > 0 && n!.active === 0) || t > Date.parse(c.startsAt) + totalWindowMs(quiz)) {
    const ended = await s`
      update quiz_control set phase = 'ended', ended_at = ${now()}
      where id = 1 and phase = 'live' returning id`;
    if (ended.length) await bump(s);
  }
}

export async function getControl(): Promise<
  QuizControl & { quizTitle: string | null; questionCount: number }
> {
  await ready();
  await advanceClock();
  const s = sql();
  const { sweptAt: _swept, ...c } = await control(s);
  void _swept;
  const quiz = await quizById(s, c.quizId);
  return { ...c, quizTitle: quiz?.title ?? null, questionCount: quiz?.questions.length ?? 0 };
}

export async function setPhase(
  action: 'unlock' | 'start' | 'end' | 'lock',
  actor: Actor,
  quizId?: string,
): Promise<QuizPhase> {
  await ready();
  await advanceClock();
  return tx(async (t) => {
    const c = await control(t, 'update');
    let phase = c.phase;
    let current = c.quizId;
    // Guarded transitions: a second admin pressing Start sees an error instead of a double start.
    if (action === 'unlock') {
      if (c.phase !== 'locked') throw new UserError('A quiz is already unlocked.');
      const quiz = await quizById(t, quizId);
      if (!quiz) throw new UserError('Pick a quiz to unlock.');
      if (quiz.questions.length === 0) throw new UserError('This quiz has no questions yet.');
      await t`delete from quiz_sessions where quiz_id = ${quiz.id}`;
      phase = 'open';
      current = quiz.id;
      await t`
        update quiz_control set quiz_id = ${quiz.id}, phase = 'open', starts_at = null,
          ended_at = null, swept_at = null
        where id = 1`;
    } else if (action === 'start') {
      if (c.phase !== 'open') throw new UserError('Unlock the quiz before starting it.');
      phase = 'countdown';
      await t`
        update quiz_control set phase = 'countdown',
          starts_at = ${new Date(Date.now() + COUNTDOWN_MS).toISOString()}
        where id = 1`;
      await t`update quizzes set ran_at = ${now()} where id = ${c.quizId}`;
    } else if (action === 'end') {
      if (c.phase !== 'live' && c.phase !== 'countdown')
        throw new UserError('The quiz is not running.');
      phase = 'ended';
      await t`update quiz_control set phase = 'ended', ended_at = ${now()} where id = 1`;
    } else {
      phase = 'locked';
      await t`update quiz_control set phase = 'locked', starts_at = null, ended_at = null where id = 1`;
    }
    await t`update quiz_control set updated_by = ${actor.id} where id = 1`;
    await writeAudit(t, actor, `quiz.${action}`, 'quiz_control', current, phase);
    await bump(t);
    return phase;
  });
}

/* ---------- players ---------- */

export async function joinQuiz(input: {
  rollNo: string;
  department: DepartmentCode;
  deviceHash: string;
}): Promise<{ token: string }> {
  await ready();
  await advanceClock();
  const taken = (s: string) =>
    new UserError(`${s} has already joined. If that wasn't you, go to the registration desk.`, 'rollNo');
  try {
    return await tx(async (t) => {
      // FOR SHARE: joins run side by side, but an admin's Start waits for them to land.
      const c = await control(t, 'share');
      const quiz = await quizById(t, c.quizId);
      if (!quiz || c.phase !== 'open') {
        throw new UserError(
          c.phase === 'locked' ? 'The quiz is not open yet.' : 'Joining has closed for this quiz.',
        );
      }
      const dup = await t<{ rollNo: string; deviceHash: string }[]>`
        select roll_no, device_hash from quiz_sessions
        where quiz_id = ${quiz.id} and (roll_no = ${input.rollNo} or device_hash = ${input.deviceHash})`;
      if (dup.some((d) => d.rollNo === input.rollNo)) throw taken(input.rollNo);
      if (dup.length) throw new UserError('This phone has already joined the quiz.');
      const order = quiz.settings.shuffleQuestions ? shuffle(quiz.questions) : quiz.questions;
      const token = randomToken();
      const optionOrders = Object.fromEntries(
        quiz.questions.map((q) => [
          q.id,
          (quiz.settings.shuffleOptions ? shuffle(q.options) : q.options).map((o) => o.id),
        ]),
      );
      await t`
        insert into quiz_sessions (id, quiz_id, roll_no, department, device_hash, token_hash,
          status, question_order, option_orders, current_index, last_heartbeat_at, answers,
          score, correct_count, correct_ms, joined_at)
        values (${newId('qs')}, ${quiz.id}, ${input.rollNo}, ${input.department},
          ${input.deviceHash}, ${tokenHash(token)}, 'active', ${order.map((q) => q.id)},
          ${t.json(optionOrders as never)}, 0, ${now()}, '[]', 0, 0, 0, ${now()})`;
      await bump(t);
      return { token };
    });
  } catch (error) {
    if (isUnique(error, 'quiz_sessions_quiz_id_roll_no_key')) throw taken(input.rollNo);
    if (isUnique(error, 'quiz_sessions_quiz_id_device_hash_key'))
      throw new UserError('This phone has already joined the quiz.');
    throw error;
  }
}

async function findSession(t: Tx, token: string | undefined, lock = false): Promise<QuizSession | null> {
  if (!token) return null;
  const [s] = await t<QuizSession[]>`
    select * from quiz_sessions
    where token_hash = ${tokenHash(token)}
      and quiz_id = (select quiz_id from quiz_control where id = 1)
    ${lock ? t`for update` : t``}`;
  return s ?? null;
}

export interface PlayerQuestion {
  id: string;
  body: string;
  options: { id: string; text: string }[];
  index: number;
  total: number;
  timeLimitS: number;
  /** Milliseconds left by the server clock when this response was built. */
  remainingMs: number;
}

export interface PlayerState {
  phase: QuizPhase;
  quizTitle: string | null;
  startsInMs: number | null;
  joinedCount: number;
  serverNow: number;
  me: null | {
    rollNo: string;
    status: QuizSession['status'];
    dqReason: string | null;
    answered: number;
    total: number;
  };
}

export async function playerState(token: string | undefined): Promise<PlayerState> {
  await ready();
  await advanceClock();
  const s = sql();
  const c = await control(s);
  const quiz = await quizById(s, c.quizId);
  const session = await findSession(s, token);
  const [n] = quiz
    ? await s<{ n: number }[]>`select count(*)::int as n from quiz_sessions where quiz_id = ${quiz.id}`
    : [{ n: 0 }];
  // Students never see scores or ranks (28 Oct amendment A7); those stay on the big screen.
  return {
    phase: c.phase,
    quizTitle: c.phase === 'locked' ? null : (quiz?.title ?? null),
    startsInMs: c.startsAt ? Date.parse(c.startsAt) - Date.now() : null,
    joinedCount: n!.n,
    serverNow: Date.now(),
    me: session
      ? {
          rollNo: session.rollNo,
          status: session.status,
          dqReason: session.dqReason,
          answered: session.answers.length,
          total: session.questionOrder.length,
        }
      : null,
  };
}

function serve(quiz: Quiz, session: QuizSession): PlayerQuestion | null {
  const t = Date.now();
  // Expire the current question if its time ran out without an answer: a recorded miss.
  while (session.currentIndex < session.questionOrder.length) {
    const qid = session.questionOrder[session.currentIndex]!;
    const question = quiz.questions.find((q) => q.id === qid);
    if (!question) {
      session.currentIndex++;
      continue;
    }
    if (
      session.servedAt &&
      t - Date.parse(session.servedAt) > question.timeLimitS * 1000 + ANSWER_GRACE_MS
    ) {
      session.answers.push({
        questionId: qid,
        optionId: null,
        correct: false,
        points: 0,
        ms: question.timeLimitS * 1000,
      });
      session.currentIndex++;
      session.servedAt = null;
      continue;
    }
    if (!session.servedAt) session.servedAt = now();
    const elapsed = t - Date.parse(session.servedAt);
    const order = session.optionOrders[qid] ?? question.options.map((o) => o.id);
    return {
      id: qid,
      body: question.body,
      // Never includes correctOptionId (CLAUDE.md rule 10).
      options: order.map((id) => ({
        id,
        text: question.options.find((o) => o.id === id)?.text ?? '',
      })),
      index: session.currentIndex,
      total: session.questionOrder.length,
      timeLimitS: question.timeLimitS,
      remainingMs: Math.max(question.timeLimitS * 1000 - elapsed, 0),
    };
  }
  session.status = 'finished';
  session.servedAt = null;
  return null;
}

export type NextResult =
  | { kind: 'question'; question: PlayerQuestion }
  | { kind: 'done' }
  | { kind: 'disqualified'; reason: string }
  | { kind: 'waiting' };

function nextFor(phase: QuizPhase, quiz: Quiz | null, session: QuizSession): NextResult {
  if (session.status === 'disqualified')
    return { kind: 'disqualified', reason: session.dqReason ?? 'Disqualified' };
  if (phase !== 'live') return phase === 'ended' ? { kind: 'done' } : { kind: 'waiting' };
  if (!quiz) return { kind: 'waiting' };
  const question = session.status === 'active' ? serve(quiz, session) : null;
  return question ? { kind: 'question', question } : { kind: 'done' };
}

/** One player's turn: locks only their own session row, so players never wait on each other. */
async function playerTurn<T>(
  token: string | undefined,
  fn: (ctx: { t: Tx; phase: QuizPhase; quiz: Quiz | null; session: QuizSession }) => T,
): Promise<T> {
  await ready();
  await advanceClock();
  return tx(async (t) => {
    const session = await findSession(t, token, true);
    if (!session) throw new UserError('Join the quiz first.');
    const c = await control(t);
    const quiz = await quizById(t, session.quizId);
    session.lastHeartbeatAt = now();
    const result = fn({ t, phase: c.phase, quiz, session });
    await saveSession(t, session);
    await bump(t);
    return result;
  });
}

export async function nextQuestion(token: string | undefined): Promise<NextResult> {
  return playerTurn(token, ({ phase, quiz, session }) => nextFor(phase, quiz, session));
}

export async function answerQuestion(
  token: string | undefined,
  questionId: string,
  optionId: string,
): Promise<NextResult & { locked: boolean }> {
  return playerTurn(token, ({ phase, quiz, session }) => {
    const current = session.questionOrder[session.currentIndex];
    if (!quiz || phase !== 'live' || session.status !== 'active') {
      return { ...nextFor(phase, quiz, session), locked: false };
    }
    // Only the current, served, unanswered question can be answered: no skipping ahead, no re-answers.
    if (current !== questionId || !session.servedAt)
      return { ...nextFor(phase, quiz, session), locked: false };
    const question = quiz.questions.find((q) => q.id === questionId)!;
    if (!question.options.some((o) => o.id === optionId)) throw new UserError('Unknown option.');
    const elapsed = Date.now() - Date.parse(session.servedAt);
    const inTime = elapsed <= question.timeLimitS * 1000 + ANSWER_GRACE_MS;
    const correct = inTime && optionId === question.correctOptionId;
    const ms = Math.min(elapsed, question.timeLimitS * 1000);
    const points = quizPoints(correct, question.points, ms, question.timeLimitS * 1000);
    session.answers.push({ questionId, optionId: inTime ? optionId : null, correct, points, ms });
    session.score += points;
    if (correct) {
      session.correctCount += 1;
      session.correctMs += ms;
    }
    session.currentIndex += 1;
    session.servedAt = null;
    return { ...nextFor(phase, quiz, session), locked: inTime };
  });
}

export async function reportViolation(token: string | undefined, reason: string): Promise<void> {
  await ready();
  await tx(async (t) => {
    const session = await findSession(t, token, true);
    const quiz = await quizById(t, session?.quizId);
    if (!session || !quiz || session.status !== 'active') return;
    const c = await control(t);
    if (c.phase !== 'live' && c.phase !== 'countdown') return;
    if (!quiz.settings.dqOnLeave) return;
    await t`
      update quiz_sessions set status = 'disqualified', dq_reason = ${reason.slice(0, 60)}
      where id = ${session.id}`;
    await bump(t);
  });
}

export async function heartbeat(token: string | undefined): Promise<void> {
  if (!token) return;
  await ready();
  await sql()`
    update quiz_sessions set last_heartbeat_at = ${now()}
    where token_hash = ${tokenHash(token)} and status = 'active'
      and quiz_id = (select quiz_id from quiz_control where id = 1)`;
}

/* ---------- screens and admin ---------- */

export interface QuizBoardRow {
  sessionId: string;
  rollNo: string;
  department: DepartmentCode;
  score: number;
  correctCount: number;
  answered: number;
  rank: number;
}

type BoardSession = Pick<
  QuizSession,
  'id' | 'rollNo' | 'department' | 'status' | 'score' | 'correctCount' | 'correctMs' | 'joinedAt'
> & { answered: number; totalMs: number };

async function boardSessions(t: Tx, quizId: string): Promise<BoardSession[]> {
  return t<BoardSession[]>`
    select id, roll_no, department, status, score, correct_count, correct_ms, joined_at,
      jsonb_array_length(answers)::int as answered,
      coalesce((select sum((a->>'ms')::int) from jsonb_array_elements(answers) a), 0)::int as total_ms
    from quiz_sessions where quiz_id = ${quizId}`;
}

function rank(sessions: BoardSession[]) {
  return rankQuiz(
    sessions
      .filter((s) => s.status !== 'disqualified')
      .map((s) => ({
        id: s.id,
        score: s.score,
        correctCount: s.correctCount,
        correctMs: s.correctMs,
        joinedAt: s.joinedAt,
      })),
  );
}

export async function quizBoard(limit = 10): Promise<{
  rows: QuizBoardRow[];
  joined: number;
  disqualified: number;
  joinedRolls: string[];
  total: number;
}> {
  await ready();
  const s = sql();
  const c = await control(s);
  if (!c.quizId) return { rows: [], joined: 0, disqualified: 0, joinedRolls: [], total: 0 };
  const sessions = await boardSessions(s, c.quizId);
  const quiz = await quizById(s, c.quizId);
  const byId = new Map(sessions.map((x) => [x.id, x]));
  const rows = rank(sessions)
    .slice(0, limit)
    .map((r) => {
      const x = byId.get(r.id)!;
      return {
        sessionId: x.id,
        rollNo: x.rollNo,
        department: x.department,
        score: x.score,
        correctCount: x.correctCount,
        answered: x.answered,
        rank: r.rank,
      };
    });
  return {
    rows,
    joined: sessions.length,
    disqualified: sessions.filter((x) => x.status === 'disqualified').length,
    joinedRolls: [...sessions]
      .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt))
      .slice(0, 12)
      .map((x) => x.rollNo),
    total: quiz?.questions.length ?? 0,
  };
}

export async function listDisqualified(): Promise<QuizSession[]> {
  await ready();
  return sql()<QuizSession[]>`
    select * from quiz_sessions
    where quiz_id = (select quiz_id from quiz_control where id = 1) and status = 'disqualified'
    order by joined_at`;
}

export async function reinstate(sessionId: string, actor: Actor): Promise<void> {
  await ready();
  await tx(async (t) => {
    const [session] = await t<QuizSession[]>`select * from quiz_sessions where id = ${sessionId} for update`;
    if (!session || session.status !== 'disqualified') throw new UserError('Nothing to reinstate.');
    session.status = session.answers.length >= session.questionOrder.length ? 'finished' : 'active';
    session.dqReason = null;
    session.lastHeartbeatAt = now();
    await saveSession(t, session);
    await writeAudit(t, actor, 'quiz.reinstate', 'quiz_sessions', sessionId, session.rollNo);
    await bump(t);
  });
}

/** Answer key shown to a player after the quiz ends (if the admin allows it). No points, no tally. */
export async function resultsFor(token: string | undefined) {
  await ready();
  const s = sql();
  const session = await findSession(s, token);
  const quiz = await quizById(s, session?.quizId);
  const c = await control(s);
  if (!session || !quiz || c.phase !== 'ended' || !quiz.settings.revealAfterEnd) return null;
  return session.questionOrder.map((qid) => {
    const q = quiz.questions.find((x) => x.id === qid)!;
    return {
      body: q.body,
      correct: q.options.find((o) => o.id === q.correctOptionId)?.text ?? '',
    };
  });
}

export async function exportQuizCsv(quizId: string): Promise<string> {
  await ready();
  const sessions = await boardSessions(sql(), quizId);
  const ranked = new Map(rank(sessions).map((r) => [r.id, r.rank]));
  const lines = ['rank,roll_number,department,score,correct,total_time_ms,status'];
  for (const x of sessions) {
    lines.push(
      [ranked.get(x.id) ?? '', x.rollNo, x.department, x.score, x.correctCount, x.totalMs, x.status].join(','),
    );
  }
  return lines.join('\n');
}
