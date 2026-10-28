import { heartbeat } from '@chai/db';
import { json, quizToken, sameOrigin } from '@/lib/quiz-session';

// Every 5 s from a joined phone. Production stores this in Upstash with a 20 s expiry.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Forbidden' }, { status: 403 });
  await heartbeat(await quizToken());
  return json({ ok: true });
}
