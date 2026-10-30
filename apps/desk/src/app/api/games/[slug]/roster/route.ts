import { physicalRoster } from '@chai/db';
import { authStation, json, limited } from '@/lib/station';

/**
 * GET /api/games/<slug>/roster — physical games with their own game server (Hide & Seek).
 * Everyone who may play: roll number, department, status and round. No pass codes, no names.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const auth = await authStation(request, slug);
  if (!auth) return json({ error: 'Unknown station key.' }, 401);
  if (auth.game.category !== 'physical') return json({ error: 'Only for physical games.' }, 404);
  if (limited(`roster:${auth.station.id}`, 30, 60_000)) return json({ error: 'Slow down.' }, 429);
  return json({ players: await physicalRoster(auth.game.id) });
}
