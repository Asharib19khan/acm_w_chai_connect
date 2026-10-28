import { playerState, resultsFor } from '@chai/db';
import { json, jsonError, quizToken } from '@/lib/quiz-session';

export async function GET() {
  try {
    const token = await quizToken();
    const state = await playerState(token);
    const results = state.phase === 'ended' ? await resultsFor(token) : null;
    return json({ ...state, results });
  } catch (error) {
    return jsonError(error);
  }
}
