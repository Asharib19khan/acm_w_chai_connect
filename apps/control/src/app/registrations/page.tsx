import { leaderboard, listGames, listRegistrations } from '@chai/db';
import { RegistrationsPortal } from './portal';

export default async function RegistrationsPage() {
  const [games, registrations] = await Promise.all([listGames(), listRegistrations()]);
  const boards = Object.fromEntries(
    await Promise.all(games.map(async (g) => [g.id, await leaderboard(g.id, 10)] as const)),
  );
  return <RegistrationsPortal games={games} registrations={registrations} boards={boards} />;
}
