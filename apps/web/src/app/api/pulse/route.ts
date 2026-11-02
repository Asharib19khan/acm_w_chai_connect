import { studentPulse } from '@chai/db';

export const dynamic = 'force-dynamic';

/** GET /api/pulse: live questions and recent sign-ups (department + game only) for the home page. */
export async function GET() {
  return Response.json(await studentPulse(), { headers: { 'Cache-Control': 'no-store' } });
}
