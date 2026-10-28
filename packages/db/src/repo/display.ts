import 'server-only';
import { read } from '../store';
import type { QuizPhase } from '../types';
import { leaderboard, type LeaderRow } from './games';
import { getControl, quizBoard, type QuizBoardRow } from './quiz';

export interface DisplayQuestion {
  id: string;
  body: string;
  name: string | null;
  createdAt: string;
  answered: boolean;
  spotlight: boolean;
}

export interface DisplayCv {
  id: string;
  department: string;
  batch: string;
  headline: string;
  skills: string[];
  openTo: string[];
}

export interface DisplayGame {
  id: string;
  slug: string;
  name: string;
  category: 'physical' | 'mini';
  status: string;
  players: number;
  top: LeaderRow[];
}

export interface DisplayData {
  revision: number;
  marquee: string[];
  announcement: string | null;
  projectorMode: boolean;
  questions: DisplayQuestion[];
  cvs: DisplayCv[];
  cvCount: number;
  games: DisplayGame[];
  quiz: {
    phase: QuizPhase;
    title: string | null;
    startsAt: string | null;
    serverNow: number;
    questionCount: number;
    joined: number;
    disqualified: number;
    joinedRolls: string[];
    rows: QuizBoardRow[];
  };
  moments: { id: string; title: string | null; by: string }[];
}

/** Everything the auditorium screen shows. Only approved content, never names on CVs. */
export async function displayData(): Promise<DisplayData> {
  const control = await getControl();
  const db = await read();
  const board = await quizBoard(control.phase === 'ended' ? 20 : 10);
  const games = await Promise.all(
    [...db.games]
      .sort((a, b) => a.sort - b.sort)
      .map(async (g) => ({
        id: g.id,
        slug: g.slug,
        name: g.name,
        category: g.category,
        status: g.status,
        players: db.registrations.filter(
          (r) => r.gameId === g.id && (r.status === 'registered' || r.status === 'checked_in'),
        ).length,
        top: await leaderboard(g.id, 10),
      })),
  );
  const approvedCvs = db.cvs.filter((cv) => cv.status === 'approved');
  return {
    revision: db.revision,
    marquee: db.settings.marquee,
    announcement: db.settings.announcement,
    projectorMode: db.settings.projectorMode,
    questions: db.questions
      .filter((q) => q.status === 'approved')
      .sort((a, b) => (b.reviewedAt ?? '').localeCompare(a.reviewedAt ?? ''))
      .map((q) => ({
        id: q.id,
        body: q.body,
        name: q.showName ? q.displayName : null,
        createdAt: q.createdAt,
        answered: q.answered,
        spotlight: Boolean(q.spotlightAt),
      })),
    cvs: approvedCvs
      .filter((cv) => cv.consentDisplay)
      .map((cv) => ({
        id: cv.id,
        department: cv.department,
        batch: `Batch of '${cv.rollNo.slice(0, 2)}`,
        headline: cv.summary?.headline ?? '',
        skills: cv.summary?.skills ?? [],
        openTo: cv.interests,
      })),
    cvCount: approvedCvs.length,
    games,
    quiz: {
      phase: control.phase,
      title: control.quizTitle,
      startsAt: control.startsAt,
      serverNow: Date.now(),
      questionCount: control.questionCount,
      joined: board.joined,
      disqualified: board.disqualified,
      joinedRolls: board.joinedRolls,
      rows: board.rows,
    },
    moments: db.moments
      .filter((m) => m.status === 'approved' && m.coverKey)
      .slice(0, 24)
      .map((m) => ({ id: m.id, title: m.title, by: m.uploaderName })),
  };
}
