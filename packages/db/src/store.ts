import 'server-only';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DEFAULT_COMPANIES, DEFAULT_MARQUEE, GAME_SEEDS } from '@chai/core';
import { dbEnv } from './env';
import { sql, type Tx } from './sql';
import type { Settings } from './types';

/*
 * Shared helpers for the repositories. Data lives in Postgres (supabase/migrations); this file
 * seeds the fixed rows (settings, quiz control, games), keeps the change counter screens poll,
 * and holds the local-only folder used for dev keys and old dev files.
 */

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

/** Local-only folder (gitignored): dev keys and files written by older dev builds. */
export const DATA_DIR = dbEnv.dataDir ?? join(findRepoRoot(process.cwd()), '.data');

export function filePath(...parts: string[]): string {
  const full = join(DATA_DIR, 'files', ...parts);
  mkdirSync(dirname(full), { recursive: true });
  return full;
}

export function now(): string {
  return new Date().toISOString();
}

export const DEFAULT_SETTINGS: Settings = {
  marquee: DEFAULT_MARQUEE,
  announcement: null,
  switches: { questions: true, cvs: true, registration: true, moments: true },
  companies: DEFAULT_COMPANIES,
  projectorMode: false,
  moderation: true,
  cvRetentionDays: 60,
};

async function seed(): Promise<void> {
  const s = sql();
  await s`insert into settings (id, data) values (1, ${s.json(DEFAULT_SETTINGS as never)}) on conflict do nothing`;
  await s`insert into quiz_control (id) values (1) on conflict do nothing`;
  // Games added to GAME_SEEDS later appear on the next start; existing rows are left alone.
  const rows = GAME_SEEDS.map((g, i) => ({
    id: `game_${g.slug}`,
    slug: g.slug,
    name: g.name,
    category: g.category,
    status: 'open',
    capacity: g.capacity,
    teamSize: g.teamSize,
    blurb: g.blurb,
    sort: i,
  }));
  if (rows.length) await s`insert into games ${s(rows)} on conflict (slug) do nothing`;
}

const g = globalThis as unknown as { __chaiReady?: Promise<void> };

/** Seeds the fixed rows once per server process. Every repository call awaits this first. */
export function ready(): Promise<void> {
  g.__chaiReady ??= seed().catch((error) => {
    g.__chaiReady = undefined;
    throw error;
  });
  return g.__chaiReady;
}

/** Bumps the change counter screens poll. Sequences never block, so hot paths stay parallel. */
export async function bump(t: Tx): Promise<void> {
  await t`select nextval('revision_seq')`;
}

export async function revision(): Promise<number> {
  await ready();
  const [row] = await sql()`select last_value, is_called from revision_seq`;
  return row?.isCalled ? Number(row.lastValue) : 0;
}

/** Tests and `pnpm data:reset`: empties every table, then re-seeds. */
export async function resetStore(): Promise<void> {
  const s = sql();
  await s`truncate settings, quiz_control, admins, admin_sessions, recovery_codes, audit, questions,
    cvs, moments, games, registrations, score_events, game_stations, game_runs, quizzes,
    quiz_sessions restart identity cascade`;
  await s`alter sequence revision_seq restart`;
  g.__chaiReady = undefined;
  await ready();
}

/** Expected failures carry a message that is safe to show to the user. */
export class UserError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = 'UserError';
  }
}
