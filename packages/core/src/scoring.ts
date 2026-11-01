/**
 * Quiz points for one question (blueprint section 11):
 * P = c · B · (1/2 + 1/2 · (1 − t/T)), rounded. A right answer earns between half and all of B.
 */
export function quizPoints(
  correct: boolean,
  base: number,
  elapsedMs: number,
  limitMs: number,
): number {
  if (!correct) return 0;
  const t = Math.min(Math.max(elapsedMs, 0), limitMs);
  return Math.round(base * (0.5 + 0.5 * (1 - t / limitMs)));
}

export interface QuizStanding {
  id: string;
  score: number;
  correctCount: number;
  /** Total server-measured time on correct answers, ms. */
  correctMs: number;
  joinedAt: string;
}

/** Ties: more correct, then lower time on correct answers, then earlier join. */
export function rankQuiz<T extends QuizStanding>(rows: T[]): (T & { rank: number })[] {
  return [...rows]
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.correctCount - a.correctCount ||
        a.correctMs - b.correctMs ||
        a.joinedAt.localeCompare(b.joinedAt),
    )
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

/** Hide & Seek (section 13): hider score and catch value at minute t. */
export function hiderScore(minutesAlive: number, survived: boolean): number {
  return 5 * Math.min(Math.floor(minutesAlive), 20) + (survived ? 25 : 0);
}

export function catchValue(minute: number, converted: boolean): number {
  const value = 60 - 2 * Math.min(Math.max(minute, 0), 20);
  return converted ? Math.round(value / 2) : value;
}
