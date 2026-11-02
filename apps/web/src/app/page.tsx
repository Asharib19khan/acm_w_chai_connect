import { getControl } from '@chai/db';
import { HeroTitle } from '@/components/hero-title';
import { SecretTrigger } from '@/components/secret-trigger';
import { ScrollScenes, type Scene } from '@/components/scroll-scenes';
import { Marquee } from '@chai/ui';
import { LiveOrCountdown } from '@/components/live-panel';
import { HeroReveal } from '@/components/hero-reveal';
import { Burst, CrossTapes, Kettle } from '@/components/loud';

export default async function HomePage() {
  const control = await getControl();
  const quizLive = control.phase !== 'locked' && control.phase !== 'ended';

  const scenes: Scene[] = [
    ...(quizLive
      ? [
          {
            href: '/quiz',
            title: 'Quiz is live',
            note: 'Join now. It starts on the big screen’s signal.',
            cta: 'Join the quiz',
            live: true,
          },
        ]
      : []),
    {
      href: '/ask',
      title: 'Ask anything',
      note: 'Too shy to ask out loud? Ask here. Your name is optional.',
      cta: 'Ask now',
    },
    {
      href: '/cv',
      title: 'Drop your CV',
      note: 'Pick the fields you want it considered for.',
      cta: 'Upload CV',
    },
    {
      href: '/games',
      title: 'Join the games',
      note: 'One physical game and one minigame per student.',
      cta: 'Pick a game',
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-8">
      <section className="relative pt-4 sm:pt-8">
        {/* Giant outlined year behind everything. */}
        <span
          aria-hidden
          className="cc-outline-white font-display pointer-events-none absolute -top-4 right-[-6%] text-[34vw] leading-none font-black tracking-[-0.06em] select-none sm:text-[min(30vw,24rem)]"
        >
          27
        </span>
        <div className="relative">
          <HeroTitle lines={TITLE} />
          <SecretTrigger className="absolute -top-1 right-0 size-24 cursor-pointer sm:top-0 sm:right-4 sm:size-40">
            <Kettle className="relative size-full" />
          </SecretTrigger>
        </div>
        <HeroReveal delay={0.15}>
          <div className="relative mt-6 grid items-center gap-5 sm:mt-10">
            <div className="flex flex-col gap-5">
              <p
                data-pet-ledge
                className="font-display max-w-2xl text-[clamp(1.35rem,5.4vw,2.6rem)] leading-[1.02] font-black tracking-[-0.035em] uppercase"
              >
                Ask what you’re <span className="text-accent">too shy</span> to ask. Hand your CV to
                the <span className="cc-outline">people hiring</span>. Play across campus.
              </p>
              <p
                data-pet-ledge
                className="bg-accent font-display w-fit -rotate-2 px-3 py-2 text-sm leading-tight font-black text-[#000] uppercase sm:text-lg"
              >
                27 November
                <br />
                FAST-NUCES Karachi
              </p>
            </div>
          </div>
        </HeroReveal>
        <HeroReveal delay={0.25}>
          <div data-pet-ledge className="mt-8 sm:mt-12">
            <LiveOrCountdown />
          </div>
        </HeroReveal>
      </section>

      <CrossTapes a={TAPE_A} b={TAPE_B} />

      <ScrollScenes scenes={scenes} />

      <div
        aria-hidden
        className="relative left-1/2 mt-20 w-screen -translate-x-1/2 overflow-hidden"
      >
        <Marquee
          items={['Ask it', 'Drop it', 'Play it', 'Connect']}
          speed={90}
          className="cc-outline font-display h-[1.1em] text-[clamp(4rem,16vw,12rem)] leading-none font-black tracking-[-0.05em] uppercase"
          separator={<Burst className="text-accent mx-4 size-[0.4em]" />}
        />
      </div>
    </div>
  );
}

const TAPE_A = ['Ask anything', 'Drop your CV', 'Join the games', 'Chai Connect'];
const TAPE_B = ['ACM-W', '27.11.2026', 'FAST-NUCES Karachi', 'No shy questions'];
const TITLE = ['CHAI', 'CONNECT'];
