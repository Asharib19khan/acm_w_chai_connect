import 'server-only';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { DEFAULT_COMPANIES, DEFAULT_MARQUEE, GAME_SEEDS } from '@chai/core';
import { dbEnv } from './env';
import type { Db, Game } from './types';

/*
 * Local development store: one JSON file shared by both apps until Supabase is connected
 * (blueprint section 0). Every repository function goes through read() and mutate(), so swapping
 * this file for Supabase queries leaves the screens untouched.
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

export const DATA_DIR = dbEnv.dataDir ?? join(findRepoRoot(process.cwd()), '.data');
const DB_FILE = join(DATA_DIR, 'dev-db.json');
const LOCK_DIR = join(DATA_DIR, 'dev-db.lock');

export function filePath(...parts: string[]): string {
  const full = join(DATA_DIR, 'files', ...parts);
  mkdirSync(dirname(full), { recursive: true });
  return full;
}

export function now(): string {
  return new Date().toISOString();
}

function emptyDb(): Db {
  return {
    version: 1,
    settings: {
      marquee: DEFAULT_MARQUEE,
      announcement: null,
      switches: { questions: true, cvs: true, registration: true, moments: true },
      companies: DEFAULT_COMPANIES,
      projectorMode: false,
      moderation: true,
      cvRetentionDays: 60,
    },
    questions: [],
    cvs: [],
    moments: [],
    games: GAME_SEEDS.map(seedGame),
    registrations: [],
    scoreEvents: [],
    gameStations: [],
    gameRuns: [],
    quizzes: [],
    quizControl: { quizId: null, phase: 'locked', startsAt: null, endedAt: null, updatedBy: null },
    quizSessions: [],
    admins: [],
    adminSessions: [],
    recoveryCodes: [],
    audit: [],
    revision: 0,
  };
}

function seedGame(g: (typeof GAME_SEEDS)[number], i: number): Game {
  return {
    id: `game_${g.slug}`,
    slug: g.slug,
    name: g.name,
    category: g.category,
    status: 'open',
    capacity: g.capacity,
    teamSize: g.teamSize,
    blurb: g.blurb,
    sort: i,
  };
}

/** Brings an older local store up to date: new tables, and games added to GAME_SEEDS since. */
function upgrade(db: Db): Db {
  db.gameStations ??= [];
  db.gameRuns ??= [];
  GAME_SEEDS.forEach((g, i) => {
    if (!db.games.some((x) => x.slug === g.slug)) db.games.push(seedGame(g, i));
  });
  return db;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withLock<T>(fn: () => T): Promise<T> {
  mkdirSync(DATA_DIR, { recursive: true });
  const deadline = Date.now() + 5000;
  for (;;) {
    try {
      mkdirSync(LOCK_DIR);
      break;
    } catch {
      try {
        if (Date.now() - statSync(LOCK_DIR).mtimeMs > 5000)
          rmSync(LOCK_DIR, { recursive: true, force: true });
      } catch {
        // lock vanished between checks
      }
      if (Date.now() > deadline) throw new Error('Data store is busy. Try again.');
      await sleep(8);
    }
  }
  try {
    return fn();
  } finally {
    rmSync(LOCK_DIR, { recursive: true, force: true });
  }
}

function load(): Db {
  if (!existsSync(DB_FILE)) return emptyDb();
  for (let attempt = 0; ; attempt++) {
    try {
      return upgrade(JSON.parse(readFileSync(DB_FILE, 'utf8')) as Db);
    } catch (error) {
      if (attempt > 5) throw error;
    }
  }
}

function save(db: Db) {
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(db));
  for (let attempt = 0; ; attempt++) {
    try {
      renameSync(tmp, DB_FILE);
      return;
    } catch (error) {
      if (attempt > 20) throw error;
      // Windows can briefly refuse the rename while another process reads the file.
      const until = Date.now() + 10;
      while (Date.now() < until) {
        /* spin */
      }
    }
  }
}

export async function read(): Promise<Db> {
  return load();
}

/** Runs fn against the latest data under a cross-process lock and saves the result. */
export async function mutate<T>(fn: (db: Db) => T): Promise<T> {
  return withLock(() => {
    const db = load();
    const result = fn(db);
    db.revision += 1;
    save(db);
    return result;
  });
}

export async function resetStore(): Promise<void> {
  await withLock(() => save(emptyDb()));
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
