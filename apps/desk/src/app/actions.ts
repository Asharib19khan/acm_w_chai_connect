'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  actOnRegistration,
  addScore,
  autoAssign,
  createStation,
  revokeStation,
  listScoreEvents,
  setGameStatus,
  UserError,
  voidScore,
  type PublicStation,
  type RegistrationAction,
  type ScoreEvent,
} from '@chai/db';
import { requireDesk } from '@/lib/auth/session';

type Result<T = undefined> = { ok: true; data: T } | { ok: false; message: string };

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    const data = await fn();
    revalidatePath('/');
    return { ok: true, data };
  } catch (error) {
    if (error instanceof UserError) return { ok: false, message: error.message };
    if (error instanceof z.ZodError) return { ok: false, message: 'That input is not valid.' };
    console.error(error);
    return { ok: false, message: 'Something went wrong.' };
  }
}

const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('check_in') }),
  z.object({ type: z.literal('undo_check_in') }),
  z.object({ type: z.literal('withdraw') }),
  z.object({ type: z.literal('promote') }),
  z.object({ type: z.literal('disqualify') }),
  z.object({ type: z.literal('reset_pass') }),
  z.object({ type: z.literal('set_team'), team: z.string().trim().max(30).nullable() }),
  z.object({ type: z.literal('set_round'), round: z.number().int().min(1).max(50).nullable() }),
]);

export async function registrationAction(
  id: string,
  action: RegistrationAction,
): Promise<Result<{ passCode?: string }>> {
  return run(async () =>
    actOnRegistration(
      z.string().max(40).parse(id),
      actionSchema.parse(action) as RegistrationAction,
      await requireDesk(),
    ),
  );
}

export async function scoreAction(id: string, points: number, reason: string): Promise<Result> {
  return run(async () => {
    await addScore(id, points, z.string().trim().min(2).max(80).parse(reason), await requireDesk());
    return undefined;
  });
}

export async function voidAction(eventId: string, reason: string): Promise<Result> {
  return run(async () => {
    await voidScore(eventId, reason, await requireDesk());
    return undefined;
  });
}

export async function historyAction(id: string): Promise<Result<ScoreEvent[]>> {
  return run(async () => {
    await requireDesk();
    return listScoreEvents(id);
  });
}

export async function gameStatusAction(
  gameId: string,
  status: 'open' | 'closed' | 'live' | 'ended',
): Promise<Result> {
  return run(async () => {
    await setGameStatus(gameId, status, await requireDesk());
    return undefined;
  });
}

export async function autoAssignAction(
  gameId: string,
  kind: 'teams' | 'rounds',
  perRound = 16,
): Promise<Result<number>> {
  return run(async () =>
    autoAssign(gameId, kind === 'teams' ? { kind } : { kind, perRound }, await requireDesk()),
  );
}

/** Game station keys (amendment A8). The key is returned once, for the config file download. */
export async function createStationAction(
  gameId: string,
  name: string,
): Promise<Result<{ station: PublicStation; key: string; gameSlug: string }>> {
  return run(async () =>
    createStation(
      z.string().max(40).parse(gameId),
      z.string().max(40).parse(name),
      await requireDesk(),
    ),
  );
}

export async function revokeStationAction(stationId: string): Promise<Result> {
  return run(async () => {
    await revokeStation(z.string().max(40).parse(stationId), await requireDesk());
    return undefined;
  });
}
