import { stationPlayerList } from '@chai/db';
import { authStation, json, limited } from '@/lib/station';

/**
 * GET /api/games/<slug>/players — every roll number that may play this game, for the station's
 * offline list. The station refreshes it while online so it can keep checking players without Wi-Fi.
 * Roll numbers only: no names, no pass codes.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const auth = await authStation(request, slug);
  if (!auth) return json({ error: 'Unknown station key.' }, 401);
  if (limited(`players:${auth.station.id}`, 30, 60_000)) return json({ error: 'Slow down.' }, 429);
  return json({ players: await stationPlayerList(auth.game.id) });
}
