import 'server-only';
import { randomInt } from 'node:crypto';
import { quizPoints, rankQuiz, type DepartmentCode } from '@chai/core';
import { hmac, newId, randomToken, serverKey } from '../crypto';
import { mutate, now, read, UserError } from '../store';
import type {
  Db,
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

/* ---------- editor ---------- */

export async function listQuizzes(): Promise<Quiz[]> {
  return [...(await read()).quizzes].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getQuiz(id: string): Promise<Quiz | null> {
  return (await read()).quizzes.find((q) => q.id === id) ?? null;
}

function assertEditable(db: Db, quizId: string) {
  const c = db.quizControl;
  if (
    c.quizId === quizId &&
    (c.phase === 'open' || c.phase === 'countdown' || c.phase === 'live')
  ) {
    throw new UserError('This quiz is open or live. Lock it before editing.');
  }
}

export async function createQuiz(title: string, actor: Actor, from?: string): Promise<Quiz> {
  return mutate((db) => {
    const source = from ? db.quizzes.find((q) => q.id === from) : undefined;
    const quiz: Quiz = {
      id: newId('quiz'),
      title: title.trim().slice(0, 80) || 'Untitled quiz',
      settings: source ? { ...source.settings } : { ...DEFAULT_SETTINGS },
      questions: source ? source.questions.map((q) => ({ ...q, id: newId('qq') })) : [],
      ranAt: null,
      createdAt: now(),
    };
    db.quizzes.push(quiz);
    writeAudit(db, actor, from ? 'quiz.duplicate' : 'quiz.create', 'quizzes', quiz.id, quiz.title);
    return quiz;
  });
}

export async function updateQuiz(
  id: string,
  patch: { title?: string; settings?: Partial<QuizSettings> },
  actor: Actor,
): Promise<void> {
  await mutate((db) => {
    const quiz = db.quizzes.find((q) => q.id === id);
    if (!quiz) throw new UserError('Quiz not found.');
    assertEditable(db, id);
    if (patch.title !== undefined) quiz.title = patch.title.trim().slice(0, 80) || quiz.title;
    if (patch.settings) quiz.settings = { ...quiz.settings, ...patch.settings };
    writeAudit(db, actor, 'quiz.update', 'quizzes', id, Object.keys(patch).join(', '));
  });
}

export async function deleteQuiz(id: string, actor: Actor): Promise<void> {
  await mutate((db) => {
    const quiz = db.quizzes.find((q) => q.id === id);
    if (!quiz) return;
    if (quiz.ranAt) throw new UserError('This quiz has already run, so it is kept for the record.');
    assertEditable(db, id);
    db.quizzes = db.quizzes.filter((q) => q.id !== id);
    if (db.quizControl.quizId === id) db.quizControl.quizId = null;
    writeAudit(db, actor, 'quiz.delete', 'quizzes', id, quiz.title);
  });
}

export async function saveQuestion(
  quizId: string,
  question: Omit<QuizQuestion, 'id'> & { id?: string },
  actor: Actor,
): Promise<void> {
  await mutate((db) => {
    const quiz = db.quizzes.find((q) => q.id === quizId);
    if (!quiz) throw new UserError('Quiz not found.');
    assertEditable(db, quizId);
    if (question.id) {
      const index = quiz.questions.findIndex((q) => q.id === question.id);
      if (index === -1) throw new UserError('Question not found.');
      quiz.questions[index] = { ...question, id: question.id };
    } else {
      quiz.questions.push({ ...question, id: newId('qq') });
    }
    writeAudit(db, actor, 'quiz.question_save', 'quizzes', quizId, question.body.slice(0, 60));
  });
}

export async function deleteQuestion(
  quizId: string,
  questionId: string,
  actor: Actor,
): Promise<void> {
  await mutate((db) => {
    const quiz = db.quizzes.find((q) => q.id === quizId);
    if (!quiz) throw new UserError('Quiz not found.');
    assertEditable(db, quizId);
    quiz.questions = quiz.questions.filter((q) => q.id !== questionId);
    writeAudit(db, actor, 'quiz.question_delete', 'quizzes', quizId, questionId);
  });
}

export async function reorderQuestions(
  quizId: string,
  order: string[],
  actor: Actor,
): Promise<void> {
  await mutate((db) => {
    const quiz = db.quizzes.find((q) => q.id === quizId);
    if (!quiz) throw new UserError('Quiz not found.');
    assertEditable(db, quizId);
    const byId = new Map(quiz.questions.map((q) => [q.id, q]));
    const next = order.map((id) => byId.get(id)).filter((q): q is QuizQuestion => Boolean(q));
    if (next.length !== quiz.questions.length)
      throw new UserError('Reorder failed. Refresh and try again.');
    quiz.questions = next;
    writeAudit(db, actor, 'quiz.reorder', 'quizzes', quizId, null);
  });
}

export async function importQuestions(
  quizId: string,
  questions: Omit<QuizQuestion, 'id'>[],
  actor: Actor,
): Promise<number> {
  return mutate((db) => {
    const quiz = db.quizzes.find((q) => q.id === quizId);
    if (!quiz) throw new UserError('Quiz not found.');
    assertEditable(db, quizId);
    for (const q of questions) quiz.questions.push({ ...q, id: newId('qq') });
    writeAudit(db, actor, 'quiz.import', 'quizzes', quizId, `${questions.length} questions`);
    return questions.length;
  });
}

/* ---------- phase machine ---------- */

function totalWindowMs(quiz: Quiz): number {
  return quiz.questions.reduce((sum, q) => sum + q.timeLimitS * 1000 + ANSWER_GRACE_MS, 0) + 10_000;
}

/** Applies time-based transitions (countdown → live → ended). Call inside mutate. */
function advanceClock(db: Db): void {
  const c = db.quizControl;
  const quiz = db.quizzes.find((q) => q.id === c.quizId);
  if (!quiz || !c.startsAt) return;
  const t = Date.now();
  if (c.phase === 'countdown' && t >= Date.parse(c.startsAt)) c.phase = 'live';
  if (c.phase === 'live') {
    for (const s of db.quizSessions) {
      if (s.quizId !== quiz.id || s.status !== 'active') continue;
      if (
        quiz.settings.offlineSeconds > 0 &&
        t - Date.parse(s.lastHeartbeatAt) > quiz.settings.offlineSeconds * 1000
      ) {
        s.status = 'disqualified';
        s.dqReason = 'Went offline';
      }
    }
    const active = db.quizSessions.some((s) => s.quizId === quiz.id && s.status === 'active');
    const joined = db.quizSessions.some((s) => s.quizId === quiz.id);
    if ((joined && !active) || t > Date.parse(c.startsAt) + totalWindowMs(quiz)) {
      c.phase = 'ended';
      c.endedAt = now();
    }
  }
}

function needsClock(db: Db): boolean {
  const c = db.quizControl;
  return c.phase === 'countdown' || c.phase === 'live';
}

export async function getControl(): Promise<
  QuizControl & { quizTitle: string | null; questionCount: number }
> {
  let db = await read();
  if (needsClock(db)) {
    await mutate((d) => advanceClock(d));
    db = await read();
  }
  const quiz = db.quizzes.find((q) => q.id === db.quizControl.quizId);
  return {
    ...db.quizControl,
    quizTitle: quiz?.title ?? null,
    questionCount: quiz?.questions.length ?? 0,
  };
}

export async function setPhase(
  action: 'unlock' | 'start' | 'end' | 'lock',
  actor: Actor,
  quizId?: string,
): Promise<QuizPhase> {
  return mutate((db) => {
    advanceClock(db);
    const c = db.quizControl;
    // Guarded transitions: a second admin pressing Start sees an error instead of a double start.
    if (action === 'unlock') {
      if (c.phase !== 'locked') throw new UserError('A quiz is already unlocked.');
      const quiz = db.quizzes.find((q) => q.id === quizId);
      if (!quiz) throw new UserError('Pick a quiz to unlock.');
      if (quiz.questions.length === 0) throw new UserError('This quiz has no questions yet.');
      db.quizSessions = db.quizSessions.filter((s) => s.quizId !== quiz.id);
      Object.assign(c, { quizId: quiz.id, phase: 'open', startsAt: null, endedAt: null });
    } else if (action === 'start') {
      if (c.phase !== 'open') throw new UserError('Unlock the quiz before starting it.');
      c.phase = 'countdown';
      c.startsAt = new Date(Date.now() + COUNTDOWN_MS).toISOString();
      const quiz = db.quizzes.find((q) => q.id === c.quizId);
      if (quiz) quiz.ranAt = now();
    } else if (action === 'end') {
      if (c.phase !== 'live' && c.phase !== 'countdown')
        throw new UserError('The quiz is not running.');
      c.phase = 'ended';
      c.endedAt = now();
    } else {
      Object.assign(c, { phase: 'locked', startsAt: null, endedAt: null });
    }
    c.updatedBy = actor.id;
    writeAudit(db, actor, `quiz.${action}`, 'quiz_control', c.quizId, c.phase);
    return c.phase;
  });
}

/* ---------- players ---------- */

export async function joinQuiz(input: {
  rollNo: string;
  department: DepartmentCode;
  deviceHash: string;
}): Promise<{ token: string }> {
  return mutate((db) => {
    advanceClock(db);
    const c = db.quizControl;
    const quiz = db.quizzes.find((q) => q.id === c.quizId);
    if (!quiz || c.phase !== 'open') {
      throw new UserError(
        c.phase === 'locked' ? 'The quiz is not open yet.' : 'Joining has closed for this quiz.',
      );
    }
    if (db.quizSessions.some((s) => s.quizId === quiz.id && s.rollNo === input.rollNo)) {
      throw new UserError(
        `${input.rollNo} has already joined. If that wasn't you, go to the registration desk.`,
        'rollNo',
      );
    }
    if (db.quizSessions.some((s) => s.quizId === quiz.id && s.deviceHash === input.deviceHash)) {
      throw new UserError('This phone has already joined the quiz.');
    }
    const order = quiz.settings.shuffleQuestions ? shuffle(quiz.questions) : quiz.questions;
    const token = randomToken();
    db.quizSessions.push({
      id: newId('qs'),
      quizId: quiz.id,
      rollNo: input.rollNo,
      department: input.department,
      deviceHash: input.deviceHash,
      tokenHash: tokenHash(token),
      status: 'active',
      dqReason: null,
      questionOrder: order.map((q) => q.id),
      optionOrders: Object.fromEntries(
        quiz.questions.map((q) => [
          q.id,
          (quiz.settings.shuffleOptions ? shuffle(q.options) : q.options).map((o) => o.id),
        ]),
      ),
      currentIndex: 0,
      servedAt: null,
      lastHeartbeatAt: now(),
      answers: [],
      score: 0,
      correctCount: 0,
      correctMs: 0,
      joinedAt: now(),
    });
    return { token };
  });
}

function findSession(db: Db, token: string | undefined): QuizSession | null {
  if (!token) return null;
  const hash = tokenHash(token);
  return (
    db.quizSessions.find((s) => s.tokenHash === hash && s.quizId === db.quizControl.quizId) ?? null
  );
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
    score: number | null;
    rank: number | null;
  };
}

function rankSessions(db: Db, quizId: string) {
  return rankQuiz(
    db.quizSessions
      .filter((s) => s.quizId === quizId && s.status !== 'disqualified')
      .map((s) => ({
        id: s.id,
        score: s.score,
        correctCount: s.correctCount,
        correctMs: s.correctMs,
        joinedAt: s.joinedAt,
      })),
  );
}

export async function playerState(token: string | undefined): Promise<PlayerState> {
  let db = await read();
  if (needsClock(db)) {
    await mutate((d) => advanceClock(d));
    db = await read();
  }
  const c = db.quizControl;
  const quiz = db.quizzes.find((q) => q.id === c.quizId);
  const session = findSession(db, token);
  const ended = c.phase === 'ended';
  const rank =
    ended && session
      ? (rankSessions(db, session.quizId).find((r) => r.id === session.id)?.rank ?? null)
      : null;
  return {
    phase: c.phase,
    quizTitle: c.phase === 'locked' ? null : (quiz?.title ?? null),
    startsInMs: c.startsAt ? Date.parse(c.startsAt) - Date.now() : null,
    joinedCount: quiz ? db.quizSessions.filter((s) => s.quizId === quiz.id).length : 0,
    serverNow: Date.now(),
    me: session
      ? {
          rollNo: session.rollNo,
          status: session.status,
          dqReason: session.dqReason,
          answered: session.answers.length,
          total: session.questionOrder.length,
          score: session.status === 'active' && !ended ? null : session.score,
          rank,
        }
      : null,
  };
}

function serve(db: Db, quiz: Quiz, session: QuizSession): PlayerQuestion | null {
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
  | { kind: 'done'; score: number }
  | { kind: 'disqualified'; reason: string }
  | { kind: 'waiting' };

function nextFor(db: Db, session: QuizSession): NextResult {
  if (session.status === 'disqualified')
    return { kind: 'disqualified', reason: session.dqReason ?? 'Disqualified' };
  if (db.quizControl.phase !== 'live') {
    return db.quizControl.phase === 'ended'
      ? { kind: 'done', score: session.score }
      : { kind: 'waiting' };
  }
  const quiz = db.quizzes.find((q) => q.id === session.quizId);
  if (!quiz) return { kind: 'waiting' };
  const question = session.status === 'active' ? serve(db, quiz, session) : null;
  return question ? { kind: 'question', question } : { kind: 'done', score: session.score };
}

export async function nextQuestion(token: string | undefined): Promise<NextResult> {
  return mutate((db) => {
    advanceClock(db);
    const session = findSession(db, token);
    if (!session) throw new UserError('Join the quiz first.');
    session.lastHeartbeatAt = now();
    return nextFor(db, session);
  });
}

export async function answerQuestion(
  token: string | undefined,
  questionId: string,
  optionId: string,
): Promise<NextResult & { locked: boolean }> {
  return mutate((db) => {
    advanceClock(db);
    const session = findSession(db, token);
    if (!session) throw new UserError('Join the quiz first.');
    session.lastHeartbeatAt = now();
    const quiz = db.quizzes.find((q) => q.id === session.quizId);
    const current = session.questionOrder[session.currentIndex];
    if (!quiz || db.quizControl.phase !== 'live' || session.status !== 'active') {
      return { ...nextFor(db, session), locked: false };
    }
    // Only the current, served, unanswered question can be answered: no skipping ahead, no re-answers.
    if (current !== questionId || !session.servedAt)
      return { ...nextFor(db, session), locked: false };
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
    return { ...nextFor(db, session), locked: inTime };
  });
}

export async function reportViolation(token: string | undefined, reason: string): Promise<void> {
  await mutate((db) => {
    const session = findSession(db, token);
    const quiz = db.quizzes.find((q) => q.id === session?.quizId);
    if (!session || !quiz || session.status !== 'active') return;
    if (db.quizControl.phase !== 'live' && db.quizControl.phase !== 'countdown') return;
    if (!quiz.settings.dqOnLeave) return;
    session.status = 'disqualified';
    session.dqReason = reason.slice(0, 60);
  });
}

export async function heartbeat(token: string | undefined): Promise<void> {
  const db = await read();
  const session = findSession(db, token);
  if (!session || session.status !== 'active') return;
  await mutate((d) => {
    const s = d.quizSessions.find((x) => x.id === session.id);
    if (s) s.lastHeartbeatAt = now();
  });
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

export async function quizBoard(limit = 10): Promise<{
  rows: QuizBoardRow[];
  joined: number;
  disqualified: number;
  joinedRolls: string[];
  total: number;
}> {
  const db = await read();
  const quizId = db.quizControl.quizId;
  if (!quizId) return { rows: [], joined: 0, disqualified: 0, joinedRolls: [], total: 0 };
  const sessions = db.quizSessions.filter((s) => s.quizId === quizId);
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const rows = rankSessions(db, quizId)
    .slice(0, limit)
    .map((r) => {
      const s = byId.get(r.id)!;
      return {
        sessionId: s.id,
        rollNo: s.rollNo,
        department: s.department,
        score: s.score,
        correctCount: s.correctCount,
        answered: s.answers.length,
        rank: r.rank,
      };
    });
  return {
    rows,
    joined: sessions.length,
    disqualified: sessions.filter((s) => s.status === 'disqualified').length,
    joinedRolls: [...sessions]
      .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt))
      .slice(0, 12)
      .map((s) => s.rollNo),
    total: db.quizzes.find((q) => q.id === quizId)?.questions.length ?? 0,
  };
}

export async function listDisqualified(): Promise<QuizSession[]> {
  const db = await read();
  return db.quizSessions.filter(
    (s) => s.quizId === db.quizControl.quizId && s.status === 'disqualified',
  );
}

export async function reinstate(sessionId: string, actor: Actor): Promise<void> {
  await mutate((db) => {
    const session = db.quizSessions.find((s) => s.id === sessionId);
    if (!session || session.status !== 'disqualified') throw new UserError('Nothing to reinstate.');
    session.status = session.answers.length >= session.questionOrder.length ? 'finished' : 'active';
    session.dqReason = null;
    session.lastHeartbeatAt = now();
    writeAudit(db, actor, 'quiz.reinstate', 'quiz_sessions', sessionId, session.rollNo);
  });
}

export async function resultsFor(token: string | undefined) {
  const db = await read();
  const session = findSession(db, token);
  const quiz = db.quizzes.find((q) => q.id === session?.quizId);
  if (!session || !quiz || db.quizControl.phase !== 'ended' || !quiz.settings.revealAfterEnd)
    return null;
  return session.questionOrder.map((qid) => {
    const q = quiz.questions.find((x) => x.id === qid)!;
    const a = session.answers.find((x) => x.questionId === qid);
    return {
      body: q.body,
      correct: q.options.find((o) => o.id === q.correctOptionId)?.text ?? '',
      yours: q.options.find((o) => o.id === a?.optionId)?.text ?? null,
      gotIt: a?.correct ?? false,
      points: a?.points ?? 0,
    };
  });
}

export async function exportQuizCsv(quizId: string): Promise<string> {
  const db = await read();
  const ranked = new Map(rankSessions(db, quizId).map((r) => [r.id, r.rank]));
  const lines = ['rank,roll_number,department,score,correct,total_time_ms,status'];
  for (const s of db.quizSessions.filter((x) => x.quizId === quizId)) {
    const totalMs = s.answers.reduce((sum, a) => sum + a.ms, 0);
    lines.push(
      [
        ranked.get(s.id) ?? '',
        s.rollNo,
        s.department,
        s.score,
        s.correctCount,
        totalMs,
        s.status,
      ].join(','),
    );
  }
  return lines.join('\n');
}
