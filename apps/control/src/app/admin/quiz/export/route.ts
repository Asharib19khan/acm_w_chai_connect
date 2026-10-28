import { exportQuizCsv } from '@chai/db';
import { getSession } from '@/lib/auth/session';

export async function GET(request: Request) {
  if (!(await getSession())) return new Response('Not found', { status: 404 });
  const quizId = new URL(request.url).searchParams.get('quiz') ?? '';
  const csv = await exportQuizCsv(quizId);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="quiz-results-${quizId}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
