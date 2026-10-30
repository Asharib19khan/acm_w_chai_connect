import Link from 'next/link';
import { getControl } from '@chai/db';
import { ChaiCup, LiveDot } from '@chai/ui';
import { HeroReveal } from '@/components/hero-reveal';

interface Action {
  href: string;
  title: string;
  note: string;
  live?: boolean;
}

export default async function HomePage() {
  const control = await getControl();
  const quizLive = control.phase !== 'locked' && control.phase !== 'ended';

  const actions: Action[] = [
    ...(quizLive
      ? [
          {
            href: '/quiz',
            title: 'Quiz is open',
            note: 'Join now. It starts on the big screen’s signal.',
            live: true,
          },
        ]
      : []),
    {
      href: '/ask',
      title: 'Ask a question',
      note: 'Too shy to ask out loud? Ask here. Your name is optional.',
    },
    { href: '/cv', title: 'Drop your CV', note: 'Pick the fields you want it considered for.' },
    {
      href: '/games',
      title: 'Join the games',
      note: 'One physical game and one minigame per student.',
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-8">
      <section className="pt-6 pb-12 sm:pt-12 sm:pb-16">
        <HeroReveal>
          <h1
            aria-label="Chai Connect"
            className="font-display text-fg leading-[0.86] font-black tracking-[-0.045em]"
          >
            <span className="flex items-end gap-[0.12em] text-[clamp(4rem,20vw,11.5rem)]">
              Chai
              <ChaiCup className="mb-[0.06em] h-[0.9em] w-auto shrink-0" />
            </span>
            <span className="text-accent-strong block text-[clamp(2.95rem,14.8vw,8.5rem)]">
              Connect
            </span>
          </h1>
        </HeroReveal>
        <HeroReveal delay={0.12}>
          <p className="text-fg-muted mt-7 max-w-xl text-lg leading-relaxed sm:mt-10 sm:text-xl">
            Ask what you’re too shy to ask, hand your CV to the people hiring, and play across
            campus. 25 November, FAST-NUCES Karachi.
          </p>
        </HeroReveal>
      </section>

      <HeroReveal delay={0.22}>
        <ul className="border-line border-t" aria-label="What you can do">
          {actions.map((a) => (
            <li key={a.href} className="border-line border-b">
              <ActionRow {...a} />
            </li>
          ))}
        </ul>
      </HeroReveal>
    </div>
  );
}

function ActionRow({ href, title, note, live }: Action) {
  return (
    <Link
      href={href}
      className="group relative -mx-4 flex min-h-24 items-center gap-5 overflow-hidden px-4 py-5 sm:-mx-6 sm:min-h-28 sm:px-6"
    >
      {/* Plum pours in from the left on hover and press. */}
      <span
        aria-hidden
        className="bg-accent absolute inset-0 origin-left scale-x-0 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100 group-active:scale-x-100"
      />
      <span className="relative flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="font-display text-fg flex items-center gap-3 text-[clamp(1.6rem,6.4vw,2.9rem)] leading-none font-black tracking-[-0.035em]">
          {live && <LiveDot className="size-2.5" />}
          {title}
        </span>
        <span className="text-fg-muted group-hover:text-fg text-[0.95rem] transition-colors sm:text-base">
          {note}
        </span>
      </span>
      <span
        aria-hidden
        className="bg-brand text-on-brand relative grid size-11 shrink-0 place-items-center rounded-full transition-transform duration-300 group-hover:translate-x-1 sm:size-13"
      >
        <svg viewBox="0 0 24 24" className="size-5">
          <path
            d="M5 12h14m-6-6 6 6-6 6"
            stroke="currentColor"
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </Link>
  );
}
