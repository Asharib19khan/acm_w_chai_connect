import { nextQuestion } from '@chai/db';
import { json, jsonError, quizToken, sameOrigin } from '@/lib/quiz-session';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Forbidden' }, { status: 403 });
  try {
    return json({ ...(await nextQuestion(await quizToken())), serverNow: Date.now() });
  } catch (error) {
    return jsonError(error);
  }
}
