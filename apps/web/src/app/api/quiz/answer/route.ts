import { z } from 'zod';
import { answerQuestion } from '@chai/db';
import { json, jsonError, quizToken, sameOrigin } from '@/lib/quiz-session';

const body = z.object({
  questionId: z.string().min(1).max(40),
  optionId: z.string().min(1).max(40),
});

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Forbidden' }, { status: 403 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Bad answer.' }, { status: 400 });
  try {
    return json({
      ...(await answerQuestion(await quizToken(), parsed.data.questionId, parsed.data.optionId)),
      serverNow: Date.now(),
    });
  } catch (error) {
    return jsonError(error);
  }
}
