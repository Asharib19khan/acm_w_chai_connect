import { rollNumberSchema } from '@chai/core';
import { stationCheckPlayer } from '@chai/db';
import { authStation, json, limited } from '@/lib/station';

/**
 * GET /api/games/<slug>/registrations?rollNo=25K-1234&gameSlug=<slug>
 * Asked by the game before a round starts. 200 {registered, alreadyPlayed} is the answer; 401 means the station
 * key is wrong or revoked (the game then shows "can't reach the registration server").
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(request.url);
  const roll = rollNumberSchema.safeParse(url.searchParams.get('rollNo') ?? '');
  const gameSlug = url.searchParams.get('gameSlug');
  if (!roll.success || (gameSlug && gameSlug !== slug)) {
    return json({ error: 'Send a roll number like 25K-1234.' }, 400);
  }
  const auth = await authStation(request, slug);
  if (!auth) return json({ error: 'Unknown station key.' }, 401);
  if (limited(`reg:${auth.station.id}`, 240, 60_000)) return json({ error: 'Slow down.' }, 429);
  const check = await stationCheckPlayer(auth.game.id, roll.data, auth.station.name);
  // alreadyPlayed tells the game to ask for the replay key instead of just refusing.
  return json({ registered: check === 'allowed', alreadyPlayed: check === 'already_played' });
}
