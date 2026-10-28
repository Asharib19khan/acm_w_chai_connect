import type { Metadata } from 'next';
import { getSettings, listGames } from '@chai/db';
import { ClosedState, PageIntro, PageShell } from '@/components/page-intro';
import { GamesForm, LookupForm } from './games-form';

export const metadata: Metadata = { title: 'Join the games' };

export default async function GamesPage() {
  const [settings, games] = await Promise.all([getSettings(), listGames()]);
  return (
    <PageShell>
      <PageIntro title="Join the games">
        One physical game and one minigame per student. All we need is your roll number and
        department.
      </PageIntro>
      {settings.switches.registration ? (
        <GamesForm
          games={games.map((g) => ({
            id: g.id,
            name: g.name,
            category: g.category,
            blurb: g.blurb,
            teamSize: g.teamSize,
            status: g.status,
            spotsLeft: g.spotsLeft,
          }))}
        />
      ) : (
        <ClosedState what="Registration is" />
      )}
      <section className="border-petal-12 mt-20 border-t pt-10" aria-labelledby="lookup">
        <h2 id="lookup" className="font-display text-petal text-2xl font-bold">
          Already registered?
        </h2>
        <p className="text-petal-72 mt-2 mb-6">
          Check your games, team and round. Changes happen at the registration desk.
        </p>
        <LookupForm />
      </section>
    </PageShell>
  );
}
