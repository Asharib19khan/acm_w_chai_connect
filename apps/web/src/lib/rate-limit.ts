import 'server-only';

/*
 * In-memory sliding-window limiter for local development. Production swaps this for
 * @upstash/ratelimit with the same limits (blueprint section 14). Per-IP limits stay high because
 * campus Wi-Fi puts hundreds of students behind one address; per-device limits do the work.
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const t = Date.now();
  const list = (hits.get(key) ?? []).filter((at) => t - at < windowMs);
  if (list.length >= limit) {
    hits.set(key, list);
    return false;
  }
  list.push(t);
  hits.set(key, list);
  return true;
}

export const LIMITS = {
  askIp: [60, 10 * 60_000],
  cvDevice: [3, 60 * 60_000],
  cvIp: [60, 10 * 60_000],
  registerDevice: [5, 60 * 60_000],
  registerIp: [120, 10 * 60_000],
  quizJoinDevice: [3, 60 * 60_000],
  quizJoinIp: [300, 10 * 60_000],
} as const satisfies Record<string, readonly [number, number]>;

export function limited(key: string, rule: readonly [number, number]): boolean {
  return !rateLimit(key, rule[0], rule[1]);
}
