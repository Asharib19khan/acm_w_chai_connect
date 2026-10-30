import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { newId } from '../crypto';
import { mutate, now, read } from '../store';
import type { DepartmentCode } from '@chai/core';
import type { Registration } from '../types';
import { writeAudit } from './audit';
import { passHash } from './games';
import type { StationAuth } from './stations';

/*
 * Physical games run by their own game server (Hide & Seek). The game server holds a station key
 * for its game and uses it to: read the roster, sign players in with roll number + the pass code
 * they got at registration, mark GPS check-ins, and keep each player's running total here, so the
 * auditorium display and desk leaderboard show the real scores.
 */

const CAN_PLAY: Registration['status'][] = ['registered', 'checked_in'];
const actor = (auth: StationAuth) => ({ id: auth.station.id, name: `Station: ${auth.station.name}` });

export interface RosterRow {
  rollNo: string;
  department: DepartmentCode;
  status: Registration['status'];
  round: number | null;
}

export async function physicalRoster(gameId: string): Promise<RosterRow[]> {
  const db = await read();
  return db.registrations
    .filter((r) => r.gameId === gameId && CAN_PLAY.includes(r.status))
    .map((r) => ({ rollNo: r.rollNo, department: r.department, status: r.status, round: r.round }))
    .sort((a, b) => a.rollNo.localeCompare(b.rollNo));
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
  const db = await read();
  const reg = db.registrations.find((r) => r.gameId === gameId && r.rollNo === rollNo && CAN_PLAY.includes(r.status));
  if (!reg) return { kind: 'not_registered' };
  if (!/^\d{6}$/.test(passCode) || !same(reg.passCodeHash, passHash(passCode))) return { kind: 'wrong_code' };
  return { kind: 'ok', player: { rollNo: reg.rollNo, department: reg.department, status: reg.status, round: reg.round } };
}

/** The game saw the player at their gathering spot: mark them checked in on the desk too. */
export async function physicalCheckIn(auth: StationAuth, rollNo: string): Promise<boolean> {
  return mutate((db) => {
    const reg = db.registrations.find((r) => r.gameId === auth.game.id && r.rollNo === rollNo && CAN_PLAY.includes(r.status));
    if (!reg) return false;
    if (reg.status === 'registered') {
      reg.status = 'checked_in';
      reg.checkedInAt = now();
      writeAudit(db, actor(auth), 'stations.check_in', 'registrations', reg.id, `${rollNo} checked in by GPS`);
    }
    return true;
  });
}

/**
 * Sets a player's game total (0–100). Points still only change by score events (CLAUDE.md rule 7):
 * the previous game total is voided and a new event inserted, so the history stays complete.
 */
export async function physicalSetTotal(auth: StationAuth, rollNo: string, total: number, detail: string): Promise<'stored' | 'unchanged' | 'not_registered'> {
  return mutate((db) => {
    const reg = db.registrations.find((r) => r.gameId === auth.game.id && r.rollNo === rollNo && CAN_PLAY.includes(r.status));
    if (!reg) return 'not_registered' as const;
    const live = db.scoreEvents.filter((e) => e.registrationId === reg.id && e.source === 'system' && !e.voided);
    const current = live.reduce((s, e) => s + e.points, 0);
    if (current === total && live.length <= 1) return 'unchanged' as const;
    for (const e of live) { e.voided = true; e.voidReason = 'Replaced by a newer game total'; }
    if (total !== 0) {
      db.scoreEvents.push({
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
      });
    }
    writeAudit(db, actor(auth), 'stations.total', 'score_events', reg.id, `${rollNo}: ${current} → ${total}`);
    return 'stored' as const;
  });
}
