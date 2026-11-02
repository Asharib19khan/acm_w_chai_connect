import 'server-only';
import type { DepartmentCode, GameStatus } from '@chai/core';
import { confirmationCode, hmac, newId, serverKey, sixDigits } from '../crypto';
import { isUnique, sql, tx, type Tx } from '../sql';
import { bump, now, ready, UserError } from '../store';
import type { Game, Registration, RegistrationStatus, ScoreEvent } from '../types';
import { writeAudit } from './audit';
import { getSettings } from './settings';

type Actor = { id: string; name: string };

const ACTIVE: RegistrationStatus[] = ['registered', 'waitlisted', 'checked_in'];

export interface GameWithCounts extends Game {
  registered: number;
  checkedIn: number;
  waitlisted: number;
  spotsLeft: number | null;
}

type Counted = Game & { registered: number; checkedIn: number; waitlisted: number };

function withSpots(g: Counted): GameWithCounts {
  return { ...g, spotsLeft: g.capacity == null ? null : Math.max(g.capacity - g.registered, 0) };
}

async function countedGames(t: Tx, where = t`true`): Promise<Counted[]> {
  return t<Counted[]>`
    select g.*,
      count(r.id) filter (where r.status in ('registered', 'checked_in'))::int as registered,
      count(r.id) filter (where r.status = 'checked_in')::int as checked_in,
      count(r.id) filter (where r.status = 'waitlisted')::int as waitlisted
    from games g left join registrations r on r.game_id = g.id
    where ${where}
    group by g.id
    order by g.sort`;
}

export async function listGames(): Promise<GameWithCounts[]> {
  await ready();
  return (await countedGames(sql())).map(withSpots);
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
 * Registers a roll number for up to one physical and one mini game. Requests for the same roll
 * number run one at a time (advisory lock); the unique index on (roll_no, category) backs it up.
 * Each game row is locked while its spots are counted, so capacity can't be overshot.
 */
export async function register(input: {
  rollNo: string;
  department: DepartmentCode;
  gameIds: string[];
}): Promise<RegisterResult> {
  await ready();
  if (!(await getSettings()).switches.registration)
    throw new UserError('Registration is closed right now.');
  try {
    return await tx(async (t) => {
      await t`select pg_advisory_xact_lock(hashtext(${`reg:${input.rollNo}`}))`;
      const ids = [...new Set(input.gameIds)].sort();
      const found = ids.length
        ? await t<Game[]>`select * from games where id in ${t(ids)} order by id for update`
        : [];
      const games = input.gameIds.map((id) => {
        const game = found.find((g) => g.id === id);
        if (!game) throw new UserError('That game is not available.');
        if (game.status !== 'open') throw new UserError(`${game.name} is not taking registrations.`);
        return game;
      });
      const categories = games.map((g) => g.category);
      if (new Set(categories).size !== categories.length) {
        throw new UserError('Pick one physical game and one minigame at most.');
      }
      const mine = await t<(Registration & { gameName: string })[]>`
        select r.*, g.name as game_name from registrations r join games g on g.id = r.game_id
        where r.roll_no = ${input.rollNo} and r.status in ${t(ACTIVE)}
        order by r.created_at`;
      for (const game of games) {
        const clash = mine.find((r) => r.category === game.category);
        if (clash) {
          const kind = game.category === 'physical' ? 'one physical game' : 'one minigame';
          throw new UserError(
            `${input.rollNo} is already in ${clash.gameName}. Each student can join ${kind}.`,
            'rollNo',
          );
        }
      }
      const code = mine[0]?.confirmationCode ?? confirmationCode();
      const passCode = sixDigits();
      // Re-registering issues one new pass code for all of this student's games.
      await t`update registrations set pass_code_hash = ${passHash(passCode)} where roll_no = ${input.rollNo}`;
      const out: RegisterResult['games'] = [];
      for (const game of games) {
        const [cnt] = await t<{ n: number }[]>`
          select count(*)::int as n from registrations
          where game_id = ${game.id} and status in ('registered', 'checked_in')`;
        const full = game.capacity != null && (cnt?.n ?? 0) >= game.capacity;
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
          playClaimedAt: null,
        };
        await t`insert into registrations ${t(reg as never)}`;
        out.push({ name: game.name, status: reg.status });
      }
      await bump(t);
      return { confirmationCode: code, passCode, games: out };
    });
  } catch (error) {
    if (isUnique(error, 'registrations_one_per_category'))
      throw new UserError(`${input.rollNo} is already registered for a game like that.`, 'rollNo');
    throw error;
  }
}

export async function lookupRegistration(rollNo: string, code: string) {
  await ready();
  return sql()<{ game: string; status: RegistrationStatus; team: string | null; round: number | null }[]>`
    select coalesce(g.name, 'Unknown game') as game, r.status, r.team, r.round
    from registrations r left join games g on g.id = r.game_id
    where r.roll_no = ${rollNo} and r.confirmation_code = ${code.toUpperCase().trim()}
    order by r.created_at`;
}

export interface RegistrationRow extends Registration {
  gameName: string;
  total: number;
}

export async function listRegistrations(gameId?: string): Promise<RegistrationRow[]> {
  await ready();
  const s = sql();
  return s<RegistrationRow[]>`
    select r.*, coalesce(g.name, '') as game_name,
      coalesce((select sum(e.points) from score_events e
                where e.registration_id = r.id and not e.voided), 0)::int as total
    from registrations r left join games g on g.id = r.game_id
    where ${gameId ? s`r.game_id = ${gameId}` : s`true`}
    order by r.created_at`;
}

export async function listScoreEvents(registrationId: string): Promise<ScoreEvent[]> {
  await ready();
  return sql()<ScoreEvent[]>`
    select * from score_events where registration_id = ${registrationId} order by created_at desc`;
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
  await ready();
  return tx(async (t) => {
    const [reg] = await t<Registration[]>`select * from registrations where id = ${id} for update`;
    if (!reg) throw new UserError('That registration no longer exists.');
    const before = reg.status;
    let status = reg.status;
    let passCode: string | undefined;
    switch (action.type) {
      case 'check_in':
        if (reg.status !== 'registered')
          throw new UserError(`Can't check in a ${reg.status.replace('_', ' ')} player.`);
        status = 'checked_in';
        await t`update registrations set status = 'checked_in', checked_in_at = ${now()} where id = ${id}`;
        break;
      case 'undo_check_in':
        status = 'registered';
        await t`update registrations set status = 'registered', checked_in_at = null where id = ${id}`;
        break;
      case 'withdraw': {
        status = 'withdrawn';
        await t`update registrations set status = 'withdrawn' where id = ${id}`;
        // Free the spot: promote the earliest waitlisted player of the same game.
        await t`
          update registrations set status = 'registered'
          where id = (select id from registrations
                      where game_id = ${reg.gameId} and status = 'waitlisted'
                      order by created_at limit 1 for update)`;
        break;
      }
      case 'promote':
        if (reg.status !== 'waitlisted')
          throw new UserError('Only waitlisted players can be promoted.');
        status = 'registered';
        await t`update registrations set status = 'registered' where id = ${id}`;
        break;
      case 'disqualify':
        status = 'disqualified';
        await t`update registrations set status = 'disqualified' where id = ${id}`;
        break;
      case 'set_team':
        await t`update registrations set team = ${action.team} where id = ${id}`;
        break;
      case 'set_round':
        await t`update registrations set round = ${action.round} where id = ${id}`;
        break;
      case 'reset_pass':
        passCode = sixDigits();
        await t`update registrations set pass_code_hash = ${passHash(passCode)} where roll_no = ${reg.rollNo}`;
        break;
    }
    await writeAudit(
      t,
      actor,
      `registrations.${action.type}`,
      'registrations',
      id,
      `${reg.rollNo}: ${before} → ${status}`,
    );
    await bump(t);
    return { passCode };
  });
}

export async function addScore(
  registrationId: string,
  points: number,
  reason: string,
  actor: Actor,
): Promise<void> {
  await ready();
  if (!Number.isInteger(points) || points === 0 || Math.abs(points) > 1000) {
    throw new UserError('Points must be a whole number between -1000 and 1000.');
  }
  await tx(async (t) => {
    const [reg] = await t<Registration[]>`select * from registrations where id = ${registrationId}`;
    if (!reg) throw new UserError('That registration no longer exists.');
    // Points only change by inserting a score event (CLAUDE.md rule 7).
    const event: ScoreEvent = {
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
    };
    await t`insert into score_events ${t(event as never)}`;
    await writeAudit(
      t,
      actor,
      'scores.add',
      'score_events',
      registrationId,
      `${points > 0 ? '+' : ''}${points} ${reason}`,
    );
    await bump(t);
  });
}

export async function voidScore(eventId: string, reason: string, actor: Actor): Promise<void> {
  await ready();
  await tx(async (t) => {
    const [event] = await t<ScoreEvent[]>`select * from score_events where id = ${eventId} for update`;
    if (!event) throw new UserError('That score entry no longer exists.');
    if (event.voided) throw new UserError('Already voided.');
    if (reason.trim().length < 3) throw new UserError('Give a reason for voiding.');
    await t`update score_events set voided = true, void_reason = ${reason.slice(0, 120)} where id = ${eventId}`;
    await writeAudit(t, actor, 'scores.void', 'score_events', eventId, reason);
    await bump(t);
  });
}

export async function setGameStatus(
  gameId: string,
  status: GameStatus,
  actor: Actor,
): Promise<void> {
  await ready();
  await tx(async (t) => {
    const updated = await t`update games set status = ${status} where id = ${gameId} returning id`;
    if (updated.length === 0) throw new UserError('Unknown game.');
    await writeAudit(t, actor, 'games.status', 'games', gameId, status);
    await bump(t);
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
  await ready();
  return tx(async (t) => {
    const [game] = await t<Game[]>`select * from games where id = ${gameId} for update`;
    if (!game) throw new UserError('Unknown game.');
    const players = await t<Registration[]>`
      select * from registrations where game_id = ${gameId} and status = 'checked_in'
      order by created_at for update`;
    if (players.length === 0) throw new UserError('Check players in first.');
    // Interleave by department so neighbours in the list come from different departments.
    const byDept = new Map<string, Registration[]>();
    for (const p of players) byDept.set(p.department, [...(byDept.get(p.department) ?? []), p]);
    const queues = [...byDept.values()];
    const mixed: Registration[] = [];
    while (queues.some((q) => q.length))
      for (const q of queues) if (q.length) mixed.push(q.shift()!);
    const updates: { id: string; value: string }[] = [];
    if (mode.kind === 'teams') {
      const size = Math.max(game.teamSize, 1);
      const teams = Math.max(1, Math.ceil(mixed.length / size));
      mixed.forEach((p, i) => updates.push({ id: p.id, value: `Team ${(i % teams) + 1}` }));
      await t`
        update registrations r set team = v.value
        from (values ${t(updates.map((u) => [u.id, u.value]))}) as v(id, value)
        where r.id = v.id`;
    } else {
      const per = Math.max(2, Math.min(mode.perRound, 100));
      mixed.forEach((p, i) => updates.push({ id: p.id, value: String(Math.floor(i / per) + 1) }));
      await t`
        update registrations r set round = v.value::int
        from (values ${t(updates.map((u) => [u.id, u.value]))}) as v(id, value)
        where r.id = v.id`;
    }
    await writeAudit(
      t,
      actor,
      `registrations.auto_${mode.kind}`,
      'games',
      gameId,
      `${mixed.length} players`,
    );
    await bump(t);
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
  await ready();
  // Ties go to whoever reached the total first.
  const rows = await sql()<Omit<LeaderRow, 'rank'>[]>`
    select r.id as registration_id, r.roll_no, r.department, r.team,
      sum(e.points)::int as total, max(e.created_at) as last_scored_at
    from score_events e join registrations r on r.id = e.registration_id
    where e.game_id = ${gameId} and not e.voided
    group by r.id
    order by total desc, last_scored_at asc
    limit ${limit}`;
  return rows.map((row, i) => ({ ...row, rank: i + 1 }));
}
