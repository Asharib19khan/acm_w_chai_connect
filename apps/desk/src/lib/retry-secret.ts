import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { env } from '../env';

/*
 * The replay secret key. A player who already used their one turn may replay only if the game
 * crashed: the game asks for this key and sends it to /api/games/<slug>/replays. It lives only in the RETRY_SECRET environment variable
 * (apps/desk/.env.local locally, Vercel settings in production), never in git: the repo is public.
 * If it's missing, retries are simply refused.
 */
const fails = new Map<string, number[]>();

export function retryTooMany(actorId: string): boolean {
  const t = Date.now();
  const list = (fails.get(actorId) ?? []).filter((at) => t - at < 15 * 60_000);
  fails.set(actorId, list);
  return list.length >= 5;
}

export function retrySecretMatches(attempt: string, actorId?: string): boolean {
  const expected = env.RETRY_SECRET;
  if (!expected) return false;
  // Compare fixed-length digests so the check takes the same time for every attempt.
  const a = createHash('sha256').update(attempt.trim()).digest();
  const b = createHash('sha256').update(expected).digest();
  const ok = timingSafeEqual(a, b);
  if (!ok && actorId) fails.set(actorId, [...(fails.get(actorId) ?? []), Date.now()]);
  return ok;
}
