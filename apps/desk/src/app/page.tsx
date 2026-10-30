import { leaderboard, listGames, listRegistrations, listStations } from '@chai/db';
import { DeskHeader } from '@/components/desk-header';
import { SignIn } from '@/components/sign-in';
import { getSession } from '@/lib/auth/session';
import { RegistrationsPortal } from './portal';

export default async function DeskPage() {
  const info = await getSession();
  if (!info) return <SignIn />;
  const [games, registrations, stations] = await Promise.all([
    listGames(),
    listRegistrations(),
    listStations(),
  ]);
  const boards = Object.fromEntries(
    await Promise.all(games.map(async (g) => [g.id, await leaderboard(g.id, 10)] as const)),
  );
  return (
    <div className="min-h-dvh">
      <DeskHeader name={info.admin.name} expiresAt={info.session.expiresAt} />
      <div className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 sm:py-8">
        <RegistrationsPortal
          games={games}
          registrations={registrations}
          boards={boards}
          stations={stations}
        />
      </div>
    </div>
  );
}
