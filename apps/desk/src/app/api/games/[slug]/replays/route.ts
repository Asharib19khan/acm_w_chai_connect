import { z } from 'zod';
import { rollNumberSchema } from '@chai/core';
import { logWrongReplayKey, stationReplay } from '@chai/db';
import { retrySecretMatches, retryTooMany } from '@/lib/retry-secret';
import { authStation, json, limited } from '@/lib/station';

const body = z.object({
  gameSlug: z.string().max(40),
  rollNo: rollNumberSchema,
  secretKey: z.string().max(64),
});

/**
 * POST /api/games/<slug>/replays: a player who already used their one turn replays after a crash.
 * The game sends the secret key typed at the station; it is checked here, never on the laptop.
 * 200 {allowed: true} · 403 wrong key · 404 not registered · 429 five wrong keys (15 min lock).
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const text = await request.text();
  if (text.length > 1024) return json({ error: 'Body too large.' }, 413);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return json({ error: 'Send JSON.' }, 400);
  }
  const parsed = body.safeParse(raw);
  if (!parsed.success || parsed.data.gameSlug !== slug) {
    return json({ error: 'That request is not valid.' }, 400);
  }
  const auth = await authStation(request, slug);
  if (!auth) return json({ error: 'Unknown station key.' }, 401);
  if (limited(`replay:${auth.station.id}`, 30, 60_000) || retryTooMany(auth.station.id)) {
    return json({ allowed: false, error: 'Too many wrong keys. Wait 15 minutes.' }, 429);
  }
  if (!retrySecretMatches(parsed.data.secretKey, auth.station.id)) {
    await logWrongReplayKey(auth, parsed.data.rollNo);
    return json({ allowed: false, error: 'Wrong secret key.' }, 403);
  }
  const result = await stationReplay(auth, parsed.data.rollNo);
  if (result === 'not_registered') {
    return json({ allowed: false, error: 'Not registered for this game.' }, 404);
  }
  return json({ allowed: true });
}
