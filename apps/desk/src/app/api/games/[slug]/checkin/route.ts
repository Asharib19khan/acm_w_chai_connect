import { z } from 'zod';
import { rollNumberSchema } from '@chai/core';
import { physicalCheckIn } from '@chai/db';
import { authStation, json, limited } from '@/lib/station';

const body = z.object({ rollNo: rollNumberSchema });

/** POST /api/games/<slug>/checkin {rollNo} — the game saw the player at the gathering spot. */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const auth = await authStation(request, slug);
  if (!auth) return json({ error: 'Unknown station key.' }, 401);
  if (auth.game.category !== 'physical') return json({ error: 'Only for physical games.' }, 404);
  if (limited(`checkin:${auth.station.id}`, 600, 60_000)) return json({ error: 'Slow down.' }, 429);
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Send a roll number.' }, 400);
  const found = await physicalCheckIn(auth, parsed.data.rollNo);
  return found ? json({ ok: true }) : json({ error: 'not_registered' }, 404);
}
