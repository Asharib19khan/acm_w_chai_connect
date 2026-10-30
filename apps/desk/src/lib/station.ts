import 'server-only';
import { NextResponse } from 'next/server';
import { stationFromKey, type StationAuth } from '@chai/db';

/*
 * Game-station API helpers (amendment A8). Callers are game laptops, not browsers: they send
 * `Authorization: Bearer <station key>` and no cookies, so Turnstile and CSRF checks don't apply.
 * Limits are per station key, generous enough for back-to-back rounds plus retries.
 */
const hits = new Map<string, number[]>();

export function limited(key: string, limit: number, windowMs: number): boolean {
  const t = Date.now();
  const list = (hits.get(key) ?? []).filter((at) => t - at < windowMs);
  list.push(t);
  hits.set(key, list);
  return list.length > limit;
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function authStation(request: Request, slug: string): Promise<StationAuth | null> {
  const header = request.headers.get('authorization') ?? '';
  const key = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  return stationFromKey(key, slug);
}
