import 'server-only';
import { hmac, newId, randomToken, serverKey } from '../crypto';
import { mutate, now, read, UserError } from '../store';
import type { Db, Game, GameRun, GameStation, Registration } from '../types';
import { writeAudit } from './audit';

/*
 * Game stations (amendment A8): a laptop running a game (e.g. Skill Issues) holds a station key in
 * its config file. With that key it may ask "is this roll number registered for my game?" and
 * report finished rounds. Keys are created and revoked on the games desk, stored only as an HMAC,
 * and each one works for exactly one game.
 */

type Actor = { id: string; name: string };

/** Students who may play: registered or checked in. Waitlisted, withdrawn and DQ'd may not. */
const CAN_PLAY: Registration['status'][] = ['registered', 'checked_in'];

function keyHash(key: string): string {
  return hmac(serverKey('SESSION_HMAC_KEY'), `station:${key}`);
}

export type PublicStation = Omit<GameStation, 'keyHash'> & { runs: number; unmatchedRuns: number };

function toPublic(db: Db, s: GameStation): PublicStation {
  const { keyHash: _hash, ...rest } = s;
  void _hash;
  const runs = db.gameRuns.filter((r) => r.stationId === s.id);
  return {
    ...rest,
    runs: runs.length,
    unmatchedRuns: runs.filter((r) => !r.registrationId).length,
  };
}

export async function listStations(): Promise<PublicStation[]> {
  const db = await read();
  return db.gameStations
    .map((s) => toPublic(db, s))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Creates a station key. The key is returned once and never stored in readable form. */
export async function createStation(
  gameId: string,
  name: string,
  actor: Actor,
): Promise<{ station: PublicStation; key: string; gameSlug: string }> {
  return mutate((db) => {
    const game = db.games.find((g) => g.id === gameId);
    if (!game) throw new UserError('That game no longer exists.');
    const clean = name.trim().slice(0, 40);
    if (clean.length < 2) throw new UserError('Give the station a name, like "Laptop 1".');
    const key = `ccst_${randomToken(24)}`;
    const station: GameStation = {
      id: newId('st'),
      gameId,
      name: clean,
      keyHash: keyHash(key),
      createdBy: actor.id,
      createdAt: now(),
      lastSeenAt: null,
      revokedAt: null,
    };
    db.gameStations.push(station);
    writeAudit(db, actor, 'stations.create', 'game_stations', station.id, `${game.name}: ${clean}`);
    return { station: toPublic(db, station), key, gameSlug: game.slug };
  });
}

export async function revokeStation(stationId: string, actor: Actor): Promise<void> {
  await mutate((db) => {
    const station = db.gameStations.find((s) => s.id === stationId);
    if (!station) throw new UserError('That station no longer exists.');
    if (!station.revokedAt) station.revokedAt = now();
    writeAudit(db, actor, 'stations.revoke', 'game_stations', station.id, station.name);
  });
}

export interface StationAuth {
  station: PublicStation;
  game: Game;
}

/**
 * Resolves a station key for one game. Unknown, revoked or other-game keys resolve to null, so a
 * key copied from one game's laptop cannot post scores for another game.
 */
export async function stationFromKey(
  key: string | null | undefined,
  gameSlug: string,
): Promise<StationAuth | null> {
  if (!key || !/^ccst_[A-Za-z0-9_-]{20,64}$/.test(key)) return null;
  const db = await read();
  const hash = keyHash(key);
  const station = db.gameStations.find((s) => s.keyHash === hash && !s.revokedAt);
  const game = station && db.games.find((g) => g.id === station.gameId);
  if (!station || !game || game.slug !== gameSlug) return null;
  if (!station.lastSeenAt || Date.now() - Date.parse(station.lastSeenAt) > 60_000) {
    await mutate((d) => {
      const s = d.gameStations.find((x) => x.id === station.id);
      if (s) s.lastSeenAt = now();
    });
  }
  return { station: toPublic(db, station), game };
}

function playable(db: Db, gameId: string, rollNo: string): Registration | undefined {
  return db.registrations.find(
    (r) => r.gameId === gameId && r.rollNo === rollNo && CAN_PLAY.includes(r.status),
  );
}

export type StationCheck = 'allowed' | 'already_played' | 'not_registered';

/**
 * "May this roll number start a round?" Each registered player gets ONE turn (amendment A8): the
 * first yes uses it up, so a second Start (on any laptop) answers 'already_played'. The game then
 * asks for the replay key, which only a crash justifies (see stationReplay).
 */
export async function stationCheckPlayer(
  gameId: string,
  rollNo: string,
  stationName = 'station',
): Promise<StationCheck> {
  return mutate((db) => {
    const reg = playable(db, gameId, rollNo);
    if (!reg) return 'not_registered' as const;
    if (reg.playClaimedAt) return 'already_played' as const;
    reg.playClaimedAt = now();
    writeAudit(
      db,
      null,
      'stations.turn_used',
      'registrations',
      reg.id,
      `${rollNo} on ${stationName}`,
    );
    return 'allowed' as const;
  });
}

/**
 * Replay after a crash (the station already checked the secret key). The previous record is
 * replaced: its station score is voided (never edited) and the turn is used again at once, so the
 * next round from this station is the one that counts.
 */
export async function stationReplay(
  auth: StationAuth,
  rollNo: string,
): Promise<'allowed' | 'not_registered'> {
  return mutate((db) => {
    const reg = playable(db, auth.game.id, rollNo);
    if (!reg) return 'not_registered' as const;
    for (const e of db.scoreEvents)
      if (e.registrationId === reg.id && e.source === 'system' && !e.voided) {
        e.voided = true;
        e.voidReason = 'Replaced: replay after a crash';
      }
    reg.playClaimedAt = now();
    writeAudit(
      db,
      { id: auth.station.id, name: `Station: ${auth.station.name}` },
      'stations.replay',
      'registrations',
      reg.id,
      `${rollNo}: previous record replaced`,
    );
    return 'allowed' as const;
  });
}

/** Audits a wrong replay key from a station. The attempt itself is never stored. */
export async function logWrongReplayKey(auth: StationAuth, rollNo: string): Promise<void> {
  await mutate((db) => {
    writeAudit(
      db,
      { id: auth.station.id, name: `Station: ${auth.station.name}` },
      'stations.replay_denied',
      'game_stations',
      auth.station.id,
      `${rollNo}: wrong secret key`,
    );
  });
}

/** Roll numbers that may play, for the station's offline list (registered_players.txt). */
export async function stationPlayerList(gameId: string): Promise<string[]> {
  const db = await read();
  return [
    ...new Set(
      db.registrations
        .filter((r) => r.gameId === gameId && CAN_PLAY.includes(r.status))
        .map((r) => r.rollNo),
    ),
  ].sort();
}

export interface StationRunInput {
  runId: string;
  rollNo: string;
  points: number;
  progressPercent: number | null;
  bestAtSeconds: number | null;
  roundSeconds: number | null;
  playedAt: string;
}

export type StationRunResult =
  { kind: 'duplicate' } | { kind: 'stored'; matched: boolean; counted: boolean };

/**
 * Stores a finished round. One turn per player: only their FIRST round scores (one system score
 * event, CLAUDE.md rule 7); later rounds are kept but never count. "Allow another try" on the desk
 * voids that event so the next round counts. Runs from roll numbers that can't play are kept as
 * unmatched, never dropped.
 */
export async function recordStationRun(
  auth: StationAuth,
  input: StationRunInput,
): Promise<StationRunResult> {
  return mutate((db) => {
    if (db.gameRuns.some((r) => r.runId === input.runId)) return { kind: 'duplicate' as const };
    const reg = playable(db, auth.game.id, input.rollNo);
    const run: GameRun = {
      ...input,
      gameId: auth.game.id,
      stationId: auth.station.id,
      registrationId: reg?.id ?? null,
      receivedAt: now(),
    };
    db.gameRuns.push(run);
    let counted = false;
    if (reg) {
      const alreadyScored = db.scoreEvents.some(
        (e) => e.registrationId === reg.id && e.source === 'system' && !e.voided,
      );
      if (!alreadyScored) {
        counted = true;
        reg.playClaimedAt ??= now();
        db.scoreEvents.push({
          id: newId('se'),
          gameId: auth.game.id,
          registrationId: reg.id,
          points: input.points,
          reason: `Station round: ${input.points}`.slice(0, 80),
          source: 'system',
          adminId: null,
          voided: false,
          voidReason: null,
          createdAt: now(),
        });
      }
    }
    writeAudit(
      db,
      { id: auth.station.id, name: `Station: ${auth.station.name}` },
      reg ? 'stations.run' : 'stations.run_unmatched',
      'game_runs',
      input.runId,
      `${input.rollNo} ${input.points}${reg && !counted ? ' (extra round, not counted)' : ''}`,
    );
    return { kind: 'stored' as const, matched: Boolean(reg), counted };
  });
}
