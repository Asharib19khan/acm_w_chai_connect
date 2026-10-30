import { z } from 'zod';
import { rollNumberSchema } from '@chai/core';
import { physicalLogin } from '@chai/db';
import { authStation, json, limited } from '@/lib/station';

const body = z.object({ rollNo: rollNumberSchema, passCode: z.string().trim().max(12) });

/**
 * POST /api/games/<slug>/login {rollNo, passCode} — the game server signing a player in with the
 * pass code from their registration. 200 {ok, player} · 404 not registered · 403 wrong code.
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const auth = await authStation(request, slug);
  if (!auth) return json({ error: 'Unknown station key.' }, 401);
  if (auth.game.category !== 'physical') return json({ error: 'Only for physical games.' }, 404);
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Send a roll number like 25K-1234 and a pass code.' }, 400);
  if (limited(`login:${auth.station.id}`, 600, 60_000) || limited(`login:${parsed.data.rollNo}`, 10, 10 * 60_000)) {
    return json({ error: 'Too many tries. Wait a few minutes, or ask at the games desk.' }, 429);
  }
  const r = await physicalLogin(auth.game.id, parsed.data.rollNo, parsed.data.passCode);
  if (r.kind === 'not_registered') return json({ error: 'not_registered' }, 404);
  if (r.kind === 'wrong_code') return json({ error: 'wrong_code' }, 403);
  return json({ ok: true, player: r.player });
}
