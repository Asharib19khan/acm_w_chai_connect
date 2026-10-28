import { NextResponse } from 'next/server';
import { displayData } from '@chai/db';

// Public, approved-only feed for the auditorium screen. Production caches this at the edge
// (s-maxage=1) and the screen hears changes over Supabase Realtime.
export async function GET() {
  const data = await displayData();
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
}
