import { z } from 'zod';
import { rollNumberSchema } from '@chai/core';
import { physicalSetTotal } from '@chai/db';
import { authStation, json, limited } from '@/lib/station';

const body = z.object({
  totals: z
    .array(z.object({ rollNo: rollNumberSchema, total: z.number().int().min(0).max(100), detail: z.string().max(60).default('') }))
    .max(200),
});

/**
 * POST /api/games/<slug>/standings {totals: [{rollNo, total, detail}]} — each player's current game
 * total (0–100). Safe to resend: unchanged totals are skipped. Feeds the display and desk leaderboards.
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const auth = await authStation(request, slug);
  if (!auth) return json({ error: 'Unknown station key.' }, 401);
  if (auth.game.category !== 'physical') return json({ error: 'Only for physical games.' }, 404);
  if (limited(`standings:${auth.station.id}`, 60, 60_000)) return json({ error: 'Slow down.' }, 429);
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Those totals are not valid.' }, 400);
  const results: Record<string, string> = {};
  for (const t of parsed.data.totals) results[t.rollNo] = await physicalSetTotal(auth, t.rollNo, t.total, t.detail);
  return json({ ok: true, results });
}
