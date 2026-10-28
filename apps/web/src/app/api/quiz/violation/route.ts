import { reportViolation } from '@chai/db';
import { json, quizToken, sameOrigin } from '@/lib/quiz-session';

// Receives navigator.sendBeacon when the quiz tab is hidden or closed.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Forbidden' }, { status: 403 });
  const text = await request.text().catch(() => '');
  const reason = text.includes('pagehide') ? 'Closed or reloaded the quiz' : 'Left the quiz tab';
  await reportViolation(await quizToken(), reason);
  return json({ ok: true });
}
