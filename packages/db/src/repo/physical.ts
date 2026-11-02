import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import type { DepartmentCode } from '@chai/core';
import { newId } from '../crypto';
import { sql, tx, type Tx } from '../sql';
import { bump, now, ready } from '../store';
import type { Registration, ScoreEvent } from '../types';
import { writeAudit } from './audit';
import { passHash } from './games';
import type { StationAuth } from './stations';

/*
 * Physical games run by their own game server (Hide & Seek). The game server holds a station key
 * for its game and uses it to: read the roster, sign players in with roll number + the pass code
 * they got at registration, mark GPS check-ins, and keep each player's running total here, so the
 * auditorium display and desk leaderboard show the real scores.
 */

const actor = (auth: StationAuth) => ({ id: auth.station.id, name: `Station: ${auth.station.name}` });

export interface RosterRow {
  rollNo: string;
  department: DepartmentCode;
  status: Registration['status'];
  round: number | null;
}

async function playable(t: Tx, gameId: string, rollNo: string, lock = false) {
  const [reg] = await t<Registration[]>`
    select * from registrations
    where game_id = ${gameId} and roll_no = ${rollNo} and status in ('registered', 'checked_in')
    limit 1 ${lock ? t`for update` : t``}`;
  return reg;
}

export async function physicalRoster(gameId: string): Promise<RosterRow[]> {
  await ready();
  return sql()<RosterRow[]>`
    select roll_no, department, status, round from registrations
    where game_id = ${gameId} and status in ('registered', 'checked_in')
    order by roll_no`;
}

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export type PhysicalLogin =
  | { kind: 'ok'; player: RosterRow }
  | { kind: 'not_registered' }
  | { kind: 'wrong_code' };

/** Roll number + the 6-digit pass code from the registration confirmation screen. */
export async function physicalLogin(gameId: string, rollNo: string, passCode: string): Promise<PhysicalLogin> {
  await ready();
  const reg = await playable(sql(), gameId, rollNo);
  if (!reg) return { kind: 'not_registered' };
  if (!/^\d{6}$/.test(passCode) || !same(reg.passCodeHash, passHash(passCode))) return { kind: 'wrong_code' };
  return { kind: 'ok', player: { rollNo: reg.rollNo, department: reg.department, status: reg.status, round: reg.round } };
}

/** The game saw the player at their gathering spot: mark them checked in on the desk too. */
export async function physicalCheckIn(auth: StationAuth, rollNo: string): Promise<boolean> {
  await ready();
  return tx(async (t) => {
    const reg = await playable(t, auth.game.id, rollNo, true);
    if (!reg) return false;
    if (reg.status === 'registered') {
      await t`update registrations set status = 'checked_in', checked_in_at = ${now()} where id = ${reg.id}`;
      await writeAudit(t, actor(auth), 'stations.check_in', 'registrations', reg.id, `${rollNo} checked in by GPS`);
      await bump(t);
    }
    return true;
  });
}

/**
 * Sets a player's game total (0–100). Points still only change by score events (CLAUDE.md rule 7):
 * the previous game total is voided and a new event inserted, so the history stays complete.
 */
export async function physicalSetTotal(auth: StationAuth, rollNo: string, total: number, detail: string): Promise<'stored' | 'unchanged' | 'not_registered'> {
  await ready();
  return tx(async (t) => {
    const reg = await playable(t, auth.game.id, rollNo, true);
    if (!reg) return 'not_registered' as const;
    const live = await t<ScoreEvent[]>`
      select * from score_events where registration_id = ${reg.id} and source = 'system' and not voided`;
    const current = live.reduce((s, e) => s + e.points, 0);
    if (current === total && live.length <= 1) return 'unchanged' as const;
    await t`
      update score_events set voided = true, void_reason = 'Replaced by a newer game total'
      where registration_id = ${reg.id} and source = 'system' and not voided`;
    if (total !== 0) {
      const event: ScoreEvent = {
        id: newId('se'),
        gameId: auth.game.id,
        registrationId: reg.id,
        points: total,
        reason: `Game total: ${detail}`.slice(0, 80),
        source: 'system',
        adminId: null,
        voided: false,
        voidReason: null,
        createdAt: now(),
      };
      await t`insert into score_events ${t(event as never)}`;
    }
    await writeAudit(t, actor(auth), 'stations.total', 'score_events', reg.id, `${rollNo}: ${current} → ${total}`);
    await bump(t);
    return 'stored' as const;
  });
}
