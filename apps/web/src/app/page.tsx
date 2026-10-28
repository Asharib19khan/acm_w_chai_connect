import { getControl } from '@chai/db';
import { ChaiCup } from '@chai/ui';
import { FlowingMenu, type MenuRow } from '@/components/flowing-menu';
import { HeroReveal } from '@/components/hero-reveal';

export default async function HomePage() {
  const control = await getControl();
  const quizOpen = control.phase !== 'locked';

  const rows: MenuRow[] = [
    ...(quizOpen
      ? [
          {
            href: '/quiz',
            title: control.phase === 'ended' ? 'Quiz results' : 'Quiz is open',
            note:
              control.phase === 'ended'
                ? 'See how you did.'
                : 'Join now. It starts on the big screen’s signal.',
            band: ['Quiz', 'Join now', 'One shot'],
            live: control.phase !== 'ended',
          },
        ]
      : []),
    {
      href: '/ask',
      title: 'Ask a question',
      note: 'Too shy to ask out loud? Ask here. Your name is optional.',
      band: ['Ask anything', 'Name optional', 'Seen on stage'],
    },
    {
      href: '/cv',
      title: 'Drop your CV',
      note: 'Pick the fields you want it considered for.',
      band: ['Drop your CV', 'PDF only', 'Partners read it'],
    },
    {
      href: '/games',
      title: 'Join the games',
      note: 'One physical game and one minigame per student.',
      band: ['Hide & Seek', 'Scavenger Hunt', 'Campus Impostor', 'Human Bingo'],
    },
    {
      href: '/moments',
      title: 'Share moments',
      note: 'Photos in full quality, straight from your phone.',
      band: ['Full quality', 'No compression', 'Share moments'],
    },
    {
      href: '/leaderboard',
      title: 'Leaderboard',
      note: 'Every game, live.',
      band: ['Who’s winning', 'Live scores'],
    },
  ];

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pt-6 pb-14 sm:px-8 sm:pt-12 sm:pb-20">
        <HeroReveal>
          <h1
            aria-label="Chai Connect"
            className="font-display text-petal leading-[0.86] font-black tracking-[-0.045em]"
          >
            <span className="flex items-end gap-[0.12em] text-[clamp(4.2rem,21vw,13.5rem)]">
              Chai
              <ChaiCup className="mb-[0.06em] h-[0.92em] w-auto shrink-0" />
            </span>
            <span className="text-plum block text-[clamp(3.1rem,15.6vw,10rem)]">Connect</span>
          </h1>
        </HeroReveal>
        <div className="mt-8 grid gap-6 sm:mt-12 sm:grid-cols-[1fr_auto] sm:items-end">
          <p className="text-petal-72 max-w-xl text-lg leading-relaxed sm:text-xl">
            Ask what you’re too shy to ask, hand your CV to the people hiring, and play across
            campus. One afternoon, one cup at a time.
          </p>
          <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm whitespace-nowrap">
            <div>
              <dt className="text-petal-50">When</dt>
              <dd className="text-petal mt-1 font-semibold">25 November</dd>
            </div>
            <div>
              <dt className="text-petal-50">Where</dt>
              <dd className="text-petal mt-1 font-semibold">FAST-NUCES Karachi</dd>
            </div>
            <div>
              <dt className="text-petal-50">By</dt>
              <dd className="text-petal mt-1 font-semibold">ACM-W</dd>
            </div>
          </dl>
        </div>
      </section>
      <FlowingMenu rows={rows} />
    </>
  );
}
