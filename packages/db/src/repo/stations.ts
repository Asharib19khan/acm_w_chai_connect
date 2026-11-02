import 'server-only';
import { hmac, newId, randomToken, serverKey } from '../crypto';
import { sql, tx, type Tx } from '../sql';
import { bump, now, ready, UserError } from '../store';
import type { Game, GameRun, GameStation, Registration, ScoreEvent } from '../types';
import { writeAudit } from './audit';

/*
 * Game stations (amendment A8): a laptop running a game (e.g. Skill Issues) holds a station key in
 * its config file. With that key it may ask "is this roll number registered for my game?" and
 * report finished rounds. Keys are created and revoked on the games desk, stored only as an HMAC,
 * and each one works for exactly one game.
 */

type Actor = { id: string; name: string };

function keyHash(key: string): string {
  return hmac(serverKey('SESSION_HMAC_KEY'), `station:${key}`);
}

export type PublicStation = Omit<GameStation, 'keyHash'> & { runs: number; unmatchedRuns: number };

async function publicStations(t: Tx, where = t`true`): Promise<PublicStation[]> {
  return t<PublicStation[]>`
    select s.id, s.game_id, s.name, s.created_by, s.created_at, s.last_seen_at, s.revoked_at,
      count(r.run_id)::int as runs,
      count(r.run_id) filter (where r.registration_id is null)::int as unmatched_runs
    from game_stations s left join game_runs r on r.station_id = s.id
    where ${where}
    group by s.id
    order by s.created_at desc`;
}

export async function listStations(): Promise<PublicStation[]> {
  await ready();
  return publicStations(sql());
}

/** Creates a station key. The key is returned once and never stored in readable form. */
export async function createStation(
  gameId: string,
  name: string,
  actor: Actor,
): Promise<{ station: PublicStation; key: string; gameSlug: string }> {
  await ready();
  return tx(async (t) => {
    const [game] = await t<Game[]>`select * from games where id = ${gameId}`;
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
    await t`insert into game_stations ${t(station as never)}`;
    await writeAudit(t, actor, 'stations.create', 'game_stations', station.id, `${game.name}: ${clean}`);
    await bump(t);
    const [pub] = await publicStations(t, t`s.id = ${station.id}`);
    return { station: pub!, key, gameSlug: game.slug };
  });
}

export async function revokeStation(stationId: string, actor: Actor): Promise<void> {
  await ready();
  await tx(async (t) => {
    const [station] = await t<GameStation[]>`select * from game_stations where id = ${stationId} for update`;
    if (!station) throw new UserError('That station no longer exists.');
    if (!station.revokedAt) await t`update game_stations set revoked_at = ${now()} where id = ${stationId}`;
    await writeAudit(t, actor, 'stations.revoke', 'game_stations', station.id, station.name);
    await bump(t);
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
  await ready();
  const s = sql();
  const [station] = await publicStations(s, s`s.key_hash = ${keyHash(key)} and s.revoked_at is null`);
  if (!station) return null;
  const [game] = await s<Game[]>`select * from games where id = ${station.gameId}`;
  if (!game || game.slug !== gameSlug) return null;
  if (!station.lastSeenAt || Date.now() - Date.parse(station.lastSeenAt) > 60_000) {
    await s`update game_stations set last_seen_at = ${now()} where id = ${station.id}`;
  }
  return { station, game };
}

/** Students who may play: registered or checked in. Waitlisted, withdrawn and DQ'd may not. */
async function playable(t: Tx, gameId: string, rollNo: string): Promise<Registration | undefined> {
  const [reg] = await t<Registration[]>`
    select * from registrations
    where game_id = ${gameId} and roll_no = ${rollNo} and status in ('registered', 'checked_in')
    limit 1 for update`;
  return reg;
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
  await ready();
  return tx(async (t) => {
    const reg = await playable(t, gameId, rollNo);
    if (!reg) return 'not_registered' as const;
    if (reg.playClaimedAt) return 'already_played' as const;
    await t`update registrations set play_claimed_at = ${now()} where id = ${reg.id}`;
    await writeAudit(t, null, 'stations.turn_used', 'registrations', reg.id, `${rollNo} on ${stationName}`);
    await bump(t);
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
  await ready();
  return tx(async (t) => {
    const reg = await playable(t, auth.game.id, rollNo);
    if (!reg) return 'not_registered' as const;
    await t`
      update score_events set voided = true, void_reason = 'Replaced: replay after a crash'
      where registration_id = ${reg.id} and source = 'system' and not voided`;
    await t`update registrations set play_claimed_at = ${now()} where id = ${reg.id}`;
    await writeAudit(
      t,
      { id: auth.station.id, name: `Station: ${auth.station.name}` },
      'stations.replay',
      'registrations',
      reg.id,
      `${rollNo}: previous record replaced`,
    );
    await bump(t);
    return 'allowed' as const;
  });
}

/** Audits a wrong replay key from a station. The attempt itself is never stored. */
export async function logWrongReplayKey(auth: StationAuth, rollNo: string): Promise<void> {
  await ready();
  await writeAudit(
    sql(),
    { id: auth.station.id, name: `Station: ${auth.station.name}` },
    'stations.replay_denied',
    'game_stations',
    auth.station.id,
    `${rollNo}: wrong secret key`,
  );
}

/** Roll numbers that may play, for the station's offline list (registered_players.txt). */
export async function stationPlayerList(gameId: string): Promise<string[]> {
  await ready();
  const rows = await sql()<{ rollNo: string }[]>`
    select distinct roll_no from registrations
    where game_id = ${gameId} and status in ('registered', 'checked_in')
    order by roll_no`;
  return rows.map((r) => r.rollNo);
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
  await ready();
  return tx(async (t) => {
    const reg = await playable(t, auth.game.id, input.rollNo);
    const run: GameRun = {
      ...input,
      gameId: auth.game.id,
      stationId: auth.station.id,
      registrationId: reg?.id ?? null,
      receivedAt: now(),
    };
    const inserted = await t`insert into game_runs ${t(run as never)} on conflict (run_id) do nothing returning run_id`;
    if (inserted.length === 0) return { kind: 'duplicate' as const };
    let counted = false;
    if (reg) {
      const scored = await t`
        select 1 from score_events
        where registration_id = ${reg.id} and source = 'system' and not voided limit 1`;
      if (scored.length === 0) {
        counted = true;
        if (!reg.playClaimedAt)
          await t`update registrations set play_claimed_at = ${now()} where id = ${reg.id}`;
        const event: ScoreEvent = {
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
        };
        await t`insert into score_events ${t(event as never)}`;
      }
    }
    await writeAudit(
      t,
      { id: auth.station.id, name: `Station: ${auth.station.name}` },
      reg ? 'stations.run' : 'stations.run_unmatched',
      'game_runs',
      input.runId,
      `${input.rollNo} ${input.points}${reg && !counted ? ' (extra round, not counted)' : ''}`,
    );
    await bump(t);
    return { kind: 'stored' as const, matched: Boolean(reg), counted };
  });
}
