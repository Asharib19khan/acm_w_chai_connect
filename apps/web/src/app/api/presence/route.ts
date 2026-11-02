import { z } from 'zod';

export const dynamic = 'force-dynamic';

/*
 * Live readers. Each open page checks in every few seconds with a random tab id, the page it's on
 * and how far down it is (0..1). The reply lists where everyone else on that page is. Nothing about
 * who they are is stored or sent; entries vanish 20 s after a tab stops checking in.
 *
 * Kept in this server's memory: right for the single-machine event setup. A multi-server
 * deployment would move this to a shared realtime channel (e.g. Supabase Realtime presence).
 */
interface Reader {
  page: string;
  pos: number;
  at: number;
}
const readers = new Map<string, Reader>();
const STALE_MS = 20_000;
const hits = new Map<string, number>();

const body = z.object({
  id: z.string().regex(/^[a-z0-9]{8,24}$/),
  page: z
    .string()
    .max(60)
    .regex(/^\/[a-z0-9/_-]*$/),
  pos: z.number().min(0).max(1),
});

export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Bad check-in.' }, { status: 400 });
  const { id, page, pos } = parsed.data;
  const now = Date.now();

  // At most one check-in per tab every 2 seconds.
  if (now - (hits.get(id) ?? 0) < 2000) return Response.json({ others: null });
  hits.set(id, now);

  readers.set(id, { page, pos, at: now });
  const others: { k: string; pos: number }[] = [];
  for (const [rid, r] of readers) {
    if (now - r.at > STALE_MS) {
      readers.delete(rid);
      hits.delete(rid);
      continue;
    }
    // Short opaque key so the phone can animate each dot; it can't identify anyone.
    if (rid !== id && r.page === page) others.push({ k: rid.slice(-4), pos: r.pos });
  }
  return Response.json(
    { others: others.slice(0, 40) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get('id') ?? '';
  readers.delete(id);
  return new Response(null, { status: 204 });
}
