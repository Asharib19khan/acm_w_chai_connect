import { studentPulse } from '@chai/db';

export const dynamic = 'force-dynamic';

// Every phone on the home page polls this, and the answer is the same for everyone: share it.
// One database read per server copy every 2 s, and Vercel's edge serves repeats for 3 s.
let cached: { at: number; data: Promise<Awaited<ReturnType<typeof studentPulse>>> } | null = null;

/** GET /api/pulse: live questions and recent sign-ups (department + game only) for the home page. */
export async function GET() {
  if (!cached || Date.now() - cached.at > 2000) {
    const data = studentPulse();
    cached = { at: Date.now(), data };
    data.catch(() => (cached = null));
  }
  const data = await cached.data;
  return Response.json(
    { ...data, serverNow: Date.now() },
    { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=3, stale-while-revalidate=5' } },
  );
}
