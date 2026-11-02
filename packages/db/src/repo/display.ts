import 'server-only';
import { sql } from '../sql';
import { ready, revision } from '../store';
import type { Cv, Game, Moment, Question, Registration } from '../types';
import { getSettings } from './settings';
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
  await ready();
  const control = await getControl();
  const s = sql();
  const [rev, settings, board, gameRows, questions, cvs, moments] = await Promise.all([
    revision(),
    getSettings(),
    quizBoard(control.phase === 'ended' ? 20 : 10),
    s<(Game & { players: number })[]>`
      select g.*, (select count(*)::int from registrations r
                   where r.game_id = g.id and r.status in ('registered', 'checked_in')) as players
      from games g order by g.sort`,
    s<Question[]>`select * from questions where status = 'approved' order by reviewed_at desc nulls last`,
    s<Cv[]>`select * from cvs where status = 'approved'`,
    s<Moment[]>`
      select id, title, uploader_name from moments
      where status = 'approved' and cover_key is not null order by created_at desc limit 24`,
  ]);
  const games = await Promise.all(
    gameRows.map(async (g) => ({
      id: g.id,
      slug: g.slug,
      name: g.name,
      category: g.category,
      status: g.status,
      players: g.players,
      top: await leaderboard(g.id, 10),
    })),
  );
  return {
    revision: rev,
    marquee: settings.marquee,
    announcement: settings.announcement,
    projectorMode: settings.projectorMode,
    questions: questions.map((q) => ({
      id: q.id,
      body: q.body,
      name: q.showName ? q.displayName : null,
      createdAt: q.createdAt,
      answered: q.answered,
      spotlight: Boolean(q.spotlightAt),
    })),
    cvs: cvs
      .filter((cv) => cv.consentDisplay)
      .map((cv) => ({
        id: cv.id,
        department: cv.department,
        batch: `Batch of '${cv.rollNo.slice(0, 2)}`,
        headline: cv.summary?.headline ?? '',
        skills: cv.summary?.skills ?? [],
        openTo: cv.interests,
      })),
    cvCount: cvs.length,
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
    moments: moments.map((m) => ({ id: m.id, title: m.title, by: m.uploaderName })),
  };
}

export interface PulseJoin {
  /** Opaque, only used to tell joins apart on the phone. */
  key: string;
  department: string;
  game: string;
  at: string;
}

export interface StudentPulse {
  serverNow: number;
  quizLive: boolean;
  questions: { id: string; body: string; name: string | null }[];
  joins: PulseJoin[];
}

/**
 * What the student site shows live: the questions already approved for the big screen, and recent
 * sign-ups as department + game only. No names, no roll numbers and never a total.
 */
export async function studentPulse(): Promise<StudentPulse> {
  await ready();
  const control = await getControl();
  const s = sql();
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const [questions, joins] = await Promise.all([
    s<Question[]>`
      select id, body, show_name, display_name from questions
      where status = 'approved' and not answered order by created_at desc limit 8`,
    s<(Registration & { gameName: string | null })[]>`
      select r.id, r.department, r.created_at, g.name as game_name
      from registrations r left join games g on g.id = r.game_id
      where r.created_at >= ${since} and r.status <> 'withdrawn'
      order by r.created_at desc limit 6`,
  ]);
  return {
    serverNow: Date.now(),
    quizLive: control.phase !== 'locked' && control.phase !== 'ended',
    questions: questions.map((q) => ({ id: q.id, body: q.body, name: q.showName ? q.displayName : null })),
    joins: joins.map((r) => ({
      key: r.id.slice(-6),
      department: r.department,
      game: r.gameName ?? 'a game',
      at: r.createdAt,
    })),
  };
}
