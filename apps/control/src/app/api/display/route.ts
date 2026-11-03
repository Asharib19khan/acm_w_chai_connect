import { NextResponse } from 'next/server';
import { displayData } from '@chai/db';

// Public, approved-only feed for the auditorium screen. Shared for 1 s per server copy (several
// screens poll it every second during the quiz) and briefly at Vercel's edge.
let cached: { at: number; data: ReturnType<typeof displayData> } | null = null;

export async function GET() {
  if (!cached || Date.now() - cached.at > 1000) {
    const data = displayData();
    cached = { at: Date.now(), data };
    data.catch(() => (cached = null));
  }
  const data = await cached.data;
  return NextResponse.json(
    { ...data, quiz: { ...data.quiz, serverNow: Date.now() } },
    { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=1, stale-while-revalidate=2' } },
  );
}
