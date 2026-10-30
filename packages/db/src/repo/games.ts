import 'server-only';
import type { DepartmentCode, GameStatus } from '@chai/core';
import { confirmationCode, hmac, newId, serverKey, sixDigits } from '../crypto';
import { mutate, now, read, UserError } from '../store';
import type { Db, Game, Registration, RegistrationStatus, ScoreEvent } from '../types';
import { writeAudit } from './audit';

type Actor = { id: string; name: string };

const ACTIVE: RegistrationStatus[] = ['registered', 'waitlisted', 'checked_in'];

export interface GameWithCounts extends Game {
  registered: number;
  checkedIn: number;
  waitlisted: number;
  spotsLeft: number | null;
}

function counts(db: Db, game: Game): GameWithCounts {
  const regs = db.registrations.filter((r) => r.gameId === game.id);
  const registered = regs.filter(
    (r) => r.status === 'registered' || r.status === 'checked_in',
  ).length;
  return {
    ...game,
    registered,
    checkedIn: regs.filter((r) => r.status === 'checked_in').length,
    waitlisted: regs.filter((r) => r.status === 'waitlisted').length,
    spotsLeft: game.capacity == null ? null : Math.max(game.capacity - registered, 0),
  };
}

export async function listGames(): Promise<GameWithCounts[]> {
  const db = await read();
  return [...db.games].sort((a, b) => a.sort - b.sort).map((g) => counts(db, g));
}

export function passHash(code: string): string {
  return hmac(serverKey('DEVICE_TOKEN_KEY'), `pass:${code}`);
}

export interface RegisterResult {
  confirmationCode: string;
  passCode: string;
  games: { name: string; status: RegistrationStatus }[];
}

/**
 * Registers a roll number for up to one physical and one mini game. The two-games rule is checked
 * inside the locked write (the Supabase version enforces it with a unique index).
 */
export async function register(input: {
  rollNo: string;
  department: DepartmentCode;
  gameIds: string[];
}): Promise<RegisterResult> {
  return mutate((db) => {
    if (!db.settings.switches.registration)
      throw new UserError('Registration is closed right now.');
    const games = input.gameIds.map((id) => {
      const game = db.games.find((g) => g.id === id);
      if (!game) throw new UserError('That game is not available.');
      if (game.status !== 'open') throw new UserError(`${game.name} is not taking registrations.`);
      return game;
    });
    const categories = games.map((g) => g.category);
    if (new Set(categories).size !== categories.length) {
      throw new UserError('Pick one physical game and one minigame at most.');
    }
    for (const game of games) {
      const clash = db.registrations.find(
        (r) =>
          r.rollNo === input.rollNo && r.category === game.category && ACTIVE.includes(r.status),
      );
      if (clash) {
        const other = db.games.find((g) => g.id === clash.gameId)?.name ?? 'a game';
        const kind = game.category === 'physical' ? 'one physical game' : 'one minigame';
        throw new UserError(
          `${input.rollNo} is already in ${other}. Each student can join ${kind}.`,
          'rollNo',
        );
      }
    }
    const existing = db.registrations.find(
      (r) => r.rollNo === input.rollNo && ACTIVE.includes(r.status),
    );
    const code = existing?.confirmationCode ?? confirmationCode();
    const passCode = sixDigits();
    // Re-registering issues one new pass code for all of this student's games.
    for (const r of db.registrations)
      if (r.rollNo === input.rollNo) r.passCodeHash = passHash(passCode);
    const out: RegisterResult['games'] = [];
    for (const game of games) {
      const full = game.capacity != null && counts(db, game).registered >= game.capacity;
      const reg: Registration = {
        id: newId('reg'),
        rollNo: input.rollNo,
        department: input.department,
        gameId: game.id,
        category: game.category,
        status: full ? 'waitlisted' : 'registered',
        confirmationCode: code,
        passCodeHash: passHash(passCode),
        team: null,
        round: null,
        createdAt: now(),
        checkedInAt: null,
      };
      db.registrations.push(reg);
      out.push({ name: game.name, status: reg.status });
    }
    return { confirmationCode: code, passCode, games: out };
  });
}

export async function lookupRegistration(rollNo: string, code: string) {
  const db = await read();
  const regs = db.registrations.filter(
    (r) => r.rollNo === rollNo && r.confirmationCode === code.toUpperCase().trim(),
  );
  return regs.map((r) => ({
    game: db.games.find((g) => g.id === r.gameId)?.name ?? 'Unknown game',
    status: r.status,
    team: r.team,
    round: r.round,
  }));
}

export interface RegistrationRow extends Registration {
  gameName: string;
  total: number;
}

export async function listRegistrations(gameId?: string): Promise<RegistrationRow[]> {
  const db = await read();
  return db.registrations
    .filter((r) => !gameId || r.gameId === gameId)
    .map((r) => ({
      ...r,
      gameName: db.games.find((g) => g.id === r.gameId)?.name ?? '',
      total: db.scoreEvents
        .filter((e) => e.registrationId === r.id && !e.voided)
        .reduce((sum, e) => sum + e.points, 0),
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function listScoreEvents(registrationId: string): Promise<ScoreEvent[]> {
  return (await read()).scoreEvents
    .filter((e) => e.registrationId === registrationId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export type RegistrationAction =
  | { type: 'check_in' }
  | { type: 'undo_check_in' }
  | { type: 'withdraw' }
  | { type: 'promote' }
  | { type: 'disqualify' }
  | { type: 'set_team'; team: string | null }
  | { type: 'set_round'; round: number | null }
  | { type: 'reset_pass' };

export async function actOnRegistration(
  id: string,
  action: RegistrationAction,
  actor: Actor,
): Promise<{ passCode?: string }> {
  return mutate((db) => {
    const reg = db.registrations.find((r) => r.id === id);
    if (!reg) throw new UserError('That registration no longer exists.');
    const before = reg.status;
    let passCode: string | undefined;
    switch (action.type) {
      case 'check_in':
        if (reg.status !== 'registered')
          throw new UserError(`Can't check in a ${reg.status.replace('_', ' ')} player.`);
        reg.status = 'checked_in';
        reg.checkedInAt = now();
        break;
      case 'undo_check_in':
        reg.status = 'registered';
        reg.checkedInAt = null;
        break;
      case 'withdraw': {
        reg.status = 'withdrawn';
        // Free the spot: promote the earliest waitlisted player of the same game.
        const next = db.registrations
          .filter((r) => r.gameId === reg.gameId && r.status === 'waitlisted')
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
        if (next) next.status = 'registered';
        break;
      }
      case 'promote':
        if (reg.status !== 'waitlisted')
          throw new UserError('Only waitlisted players can be promoted.');
        reg.status = 'registered';
        break;
      case 'disqualify':
        reg.status = 'disqualified';
        break;
      case 'set_team':
        reg.team = action.team;
        break;
      case 'set_round':
        reg.round = action.round;
        break;
      case 'reset_pass':
        passCode = sixDigits();
        for (const r of db.registrations)
          if (r.rollNo === reg.rollNo) r.passCodeHash = passHash(passCode);
        break;
    }
    writeAudit(
      db,
      actor,
      `registrations.${action.type}`,
      'registrations',
      id,
      `${reg.rollNo}: ${before} → ${reg.status}`,
    );
    return { passCode };
  });
}

export async function addScore(
  registrationId: string,
  points: number,
  reason: string,
  actor: Actor,
): Promise<void> {
  await mutate((db) => {
    const reg = db.registrations.find((r) => r.id === registrationId);
    if (!reg) throw new UserError('That registration no longer exists.');
    if (!Number.isInteger(points) || points === 0 || Math.abs(points) > 1000) {
      throw new UserError('Points must be a whole number between -1000 and 1000.');
    }
    // Points only change by inserting a score event (CLAUDE.md rule 7).
    db.scoreEvents.push({
      id: newId('se'),
      gameId: reg.gameId,
      registrationId,
      points,
      reason: reason.slice(0, 80),
      source: 'admin',
      adminId: actor.id,
      voided: false,
      voidReason: null,
      createdAt: now(),
    });
    writeAudit(
      db,
      actor,
      'scores.add',
      'score_events',
      registrationId,
      `${points > 0 ? '+' : ''}${points} ${reason}`,
    );
  });
}

export async function voidScore(eventId: string, reason: string, actor: Actor): Promise<void> {
  await mutate((db) => {
    const event = db.scoreEvents.find((e) => e.id === eventId);
    if (!event) throw new UserError('That score entry no longer exists.');
    if (event.voided) throw new UserError('Already voided.');
    if (reason.trim().length < 3) throw new UserError('Give a reason for voiding.');
    event.voided = true;
    event.voidReason = reason.slice(0, 120);
    writeAudit(db, actor, 'scores.void', 'score_events', eventId, reason);
  });
}

export async function setGameStatus(
  gameId: string,
  status: GameStatus,
  actor: Actor,
): Promise<void> {
  await mutate((db) => {
    const game = db.games.find((g) => g.id === gameId);
    if (!game) throw new UserError('Unknown game.');
    game.status = status;
    writeAudit(db, actor, 'games.status', 'games', gameId, status);
  });
}

/**
 * Splits checked-in players into teams of the game's size, dealing departments round-robin so
 * each team mixes departments; or into rounds of `perRound` players.
 */
export async function autoAssign(
  gameId: string,
  mode: { kind: 'teams' } | { kind: 'rounds'; perRound: number },
  actor: Actor,
): Promise<number> {
  return mutate((db) => {
    const game = db.games.find((g) => g.id === gameId);
    if (!game) throw new UserError('Unknown game.');
    const players = db.registrations.filter(
      (r) => r.gameId === gameId && r.status === 'checked_in',
    );
    if (players.length === 0) throw new UserError('Check players in first.');
    // Interleave by department so neighbours in the list come from different departments.
    const byDept = new Map<string, Registration[]>();
    for (const p of players) byDept.set(p.department, [...(byDept.get(p.department) ?? []), p]);
    const queues = [...byDept.values()];
    const mixed: Registration[] = [];
    while (queues.some((q) => q.length))
      for (const q of queues) if (q.length) mixed.push(q.shift()!);
    if (mode.kind === 'teams') {
      const size = Math.max(game.teamSize, 1);
      const teams = Math.max(1, Math.ceil(mixed.length / size));
      mixed.forEach((p, i) => (p.team = `Team ${(i % teams) + 1}`));
    } else {
      const per = Math.max(2, Math.min(mode.perRound, 100));
      mixed.forEach((p, i) => (p.round = Math.floor(i / per) + 1));
    }
    writeAudit(
      db,
      actor,
      `registrations.auto_${mode.kind}`,
      'games',
      gameId,
      `${mixed.length} players`,
    );
    return mixed.length;
  });
}

export async function registrationsCsv(gameId?: string): Promise<string> {
  const rows = await listRegistrations(gameId);
  const lines = [
    'game,roll_number,department,status,team,round,total,registered_at,checked_in_at,confirmation',
  ];
  for (const r of rows) {
    lines.push(
      [
        r.gameName,
        r.rollNo,
        r.department,
        r.status,
        r.team ?? '',
        r.round ?? '',
        r.total,
        r.createdAt,
        r.checkedInAt ?? '',
        r.confirmationCode,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
  }
  return lines.join('\n');
}

export interface LeaderRow {
  registrationId: string;
  rollNo: string;
  department: DepartmentCode;
  team: string | null;
  total: number;
  lastScoredAt: string;
  rank: number;
}

export async function leaderboard(gameId: string, limit = 10): Promise<LeaderRow[]> {
  const db = await read();
  const rows = new Map<string, LeaderRow>();
  for (const e of db.scoreEvents) {
    if (e.gameId !== gameId || e.voided) continue;
    const reg = db.registrations.find((r) => r.id === e.registrationId);
    if (!reg) continue;
    const row = rows.get(reg.id) ?? {
      registrationId: reg.id,
      rollNo: reg.rollNo,
      department: reg.department,
      team: reg.team,
      total: 0,
      lastScoredAt: e.createdAt,
      rank: 0,
    };
    row.total += e.points;
    if (e.createdAt > row.lastScoredAt) row.lastScoredAt = e.createdAt;
    rows.set(reg.id, row);
  }
  // Ties go to whoever reached the total first.
  return [...rows.values()]
    .sort((a, b) => b.total - a.total || a.lastScoredAt.localeCompare(b.lastScoredAt))
    .slice(0, limit)
    .map((row, i) => ({ ...row, rank: i + 1 }));
}
