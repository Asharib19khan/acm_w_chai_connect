import { z } from 'zod';
import { rollNumberSchema, STATION_DEFAULT_MAX_POINTS, STATION_MAX_POINTS } from '@chai/core';
import { recordStationRun } from '@chai/db';
import { authStation, json, limited } from '@/lib/station';

/*
 * Strict on what decides a score (runId, rollNo, points); lenient on the extras. The game stops
 * its upload queue at the first rejected run and retries that run forever, so an odd extra value
 * must never cause a 400 that blocks every round after it.
 */
const extra = (min: number, max: number) =>
  z
    .unknown()
    .transform((v) =>
      typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(v, min), max) : null,
    );

const runSchema = z.object({
  gameSlug: z.string().max(40),
  runId: z.string().regex(/^[0-9a-f]{32}$/),
  rollNo: rollNumberSchema,
  points: z.number().int().min(0).max(Math.max(STATION_DEFAULT_MAX_POINTS, ...Object.values(STATION_MAX_POINTS))),
  progressPercent: extra(0, 100),
  bestAtSeconds: extra(0, 86_400),
  roundSeconds: extra(0, 86_400),
  playedAt: z
    .unknown()
    .transform((v) =>
      typeof v === 'string' && !Number.isNaN(Date.parse(v))
        ? new Date(v).toISOString()
        : new Date().toISOString(),
    ),
});

/**
 * POST /api/games/<slug>/scores — one finished round from a game station.
 * 201 stored · 409 this runId was already stored (the game treats both as synced) ·
 * 400 bad body · 401 unknown station key · 429 too fast. Anything but 2xx/409 is retried by the game.
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const text = await request.text();
  if (text.length > 4096) return json({ error: 'Body too large.' }, 413);
  let raw: unknown;
  try {
    // .NET writes NaN/Infinity for broken floats, which is not JSON. Treat them as missing.
    raw = JSON.parse(text.replace(/:\s*-?(NaN|Infinity)\b/g, ': null'));
  } catch {
    return json({ error: 'Send JSON.' }, 400);
  }
  const parsed = runSchema.safeParse(raw);
  if (!parsed.success || parsed.data.gameSlug !== slug) {
    return json({ error: 'That run is not valid.' }, 400);
  }
  if (parsed.data.points > (STATION_MAX_POINTS[slug] ?? STATION_DEFAULT_MAX_POINTS)) {
    return json({ error: 'That run is not valid.' }, 400);
  }
  const auth = await authStation(request, slug);
  if (!auth) return json({ error: 'Unknown station key.' }, 401);
  if (limited(`run:${auth.station.id}`, 120, 60_000)) return json({ error: 'Slow down.' }, 429);
  const { gameSlug: _slug, ...run } = parsed.data;
  void _slug;
  const result = await recordStationRun(auth, run);
  if (result.kind === 'duplicate') return json({ stored: true, duplicate: true }, 409);
  return json({ stored: true, matched: result.matched, counted: result.counted }, 201);
}
