import type { Metadata } from 'next';
import { getControl, leaderboard, listGames, quizBoard } from '@chai/db';
import { PageIntro, PageShell } from '@/components/page-intro';
import { Boards, type Board } from './boards';

export const metadata: Metadata = { title: 'Leaderboard' };

export default async function LeaderboardPage() {
  const [games, control] = await Promise.all([listGames(), getControl()]);
  const boards: Board[] = await Promise.all(
    games.map(async (g) => ({
      id: g.id,
      name: g.name,
      category: g.category,
      rows: (await leaderboard(g.id, 20)).map((r) => ({
        key: r.registrationId,
        label: r.team ?? r.rollNo,
        sub: r.department,
        score: r.total,
        rank: r.rank,
      })),
    })),
  );
  if (control.phase === 'ended') {
    const quiz = await quizBoard(20);
    boards.unshift({
      id: 'quiz',
      name: 'Quiz',
      category: 'quiz',
      rows: quiz.rows.map((r) => ({
        key: r.sessionId,
        label: r.rollNo,
        sub: r.department,
        score: r.score,
        rank: r.rank,
      })),
    });
  }
  return (
    <PageShell wide>
      <PageIntro title="Leaderboard">Every game, updated as scores come in.</PageIntro>
      <Boards boards={boards} />
    </PageShell>
  );
}
