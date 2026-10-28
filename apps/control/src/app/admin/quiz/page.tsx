import { getControl, listDisqualified, listQuizzes, quizBoard } from '@chai/db';
import { QuizEditor } from './quiz-editor';

export const metadata = { title: 'Quiz' };

export default async function QuizAdmin() {
  const [quizzes, control, board, dq] = await Promise.all([
    listQuizzes(),
    getControl(),
    quizBoard(10),
    listDisqualified(),
  ]);
  return (
    <QuizEditor
      quizzes={quizzes}
      control={{ phase: control.phase, quizId: control.quizId, title: control.quizTitle }}
      joined={board.joined}
      disqualified={dq.map((s) => ({
        id: s.id,
        rollNo: s.rollNo,
        reason: s.dqReason ?? 'Disqualified',
        answered: s.answers.length,
      }))}
    />
  );
}
