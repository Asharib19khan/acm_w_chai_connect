import { registrationsCsv } from '@chai/db';
import { getSession } from '@/lib/auth/session';

export async function GET(request: Request) {
  if (!(await getSession())) return new Response('Not found', { status: 404 });
  const game = new URL(request.url).searchParams.get('game') || undefined;
  return new Response(await registrationsCsv(game), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="registrations${game ? `-${game}` : ''}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
