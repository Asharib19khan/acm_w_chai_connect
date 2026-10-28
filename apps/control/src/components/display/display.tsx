'use client';

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DisplayData } from '@chai/db';
import { LiveDot, Marquee, Star, Wordmark, cn } from '@chai/ui';
import { LoginDialog, useLongPress, useSecretCombo } from '../hotkey-login';
import { CardBody, CARDS, type CardId } from './cards';
import { PresenterBar } from './presenter-bar';

interface Props {
  initial: DisplayData;
  presenter: { name: string } | null;
  quizzes: { id: string; title: string; count: number }[];
  studentUrl: string;
}

const IDLE_MS = 60_000;
const ROTATE_MS = 20_000;

export function Display({ initial, presenter, quizzes, studentUrl }: Props) {
  const reduce = useReducedMotion();
  const [data, setData] = useState(initial);
  const [open, setOpen] = useState<CardId | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [idle, setIdle] = useState(false);
  const [rotate, setRotate] = useState(true);
  const [stale, setStale] = useState(false);
  const lastInput = useRef(0);

  // Live data: poll the cached feed. Production adds Supabase Realtime pings on display_events.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch('/api/display', { cache: 'no-store' });
        const next = (await res.json()) as DisplayData;
        if (alive) {
          setData((prev) =>
            prev.revision === next.revision && prev.quiz.phase === next.quiz.phase ? prev : next,
          );
          setStale(false);
        }
      } catch {
        if (alive) setStale(true);
      }
    };
    const fast =
      data.quiz.phase === 'live' || data.quiz.phase === 'countdown' || data.quiz.phase === 'open';
    const id = setInterval(tick, fast ? 1000 : 2500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [data.quiz.phase]);

  // When the quiz is unlocked, jump to the quiz card.
  const lastPhase = useRef(data.quiz.phase);
  useEffect(() => {
    if (lastPhase.current !== data.quiz.phase && data.quiz.phase !== 'locked') setOpen('quiz');
    lastPhase.current = data.quiz.phase;
  }, [data.quiz.phase]);

  const openLogin = useCallback(() => setLoginOpen(true), []);
  useSecretCombo(openLogin);
  const longPress = useLongPress(openLogin);

  // Keys 1–5 open cards, Esc returns home.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      lastInput.current = Date.now();
      setIdle(false);
      if (loginOpen || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.closest('input,textarea,select')) return;
      const card = CARDS.find((c) => c.key === e.key);
      if (card) setOpen(card.id);
      if (e.key === 'Escape') setOpen(null);
    };
    const onMove = () => {
      lastInput.current = Date.now();
      setIdle(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerdown', onMove);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onMove);
    };
  }, [loginOpen]);

  // Idle mode: after a minute without input, cycle through the cards.
  useEffect(() => {
    lastInput.current = Date.now();
    const id = setInterval(() => {
      if (Date.now() - lastInput.current > IDLE_MS) setIdle(true);
    }, 5000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!idle || !rotate) return;
    if (data.quiz.phase === 'live' || data.quiz.phase === 'countdown') return;
    const order: (CardId | null)[] = [null, 'questions', 'cvs', 'games', 'quiz'];
    const id = setInterval(() => {
      setOpen((current) => order[(order.indexOf(current) + 1) % order.length] ?? null);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [idle, rotate, data.quiz.phase]);

  const top = data.announcement ? [data.announcement, ...data.marquee] : data.marquee;
  const spotlight = data.questions.find((q) => q.spotlight);

  return (
    <div
      className="cc-stage text-petal flex h-dvh flex-col overflow-hidden"
      data-projector={data.projectorMode}
    >
      <h1 className="sr-only">Chai Connect</h1>
      <Marquee
        items={top}
        speed={70}
        className="bg-plum font-display text-ink h-[3.4em] shrink-0 text-[1.45em] font-bold tracking-[0.06em]"
        separator={<Star className="size-[0.6em]" />}
      />
      <header className="flex shrink-0 items-center justify-between px-[3em] py-[1.4em]">
        <button
          type="button"
          className="rounded-xl select-none"
          aria-label="Chai Connect"
          {...longPress}
        >
          <Wordmark className="text-[2em]" />
        </button>
        <div className="flex items-center gap-[1.5em]">
          {data.quiz.phase !== 'locked' && (
            <Chip>
              <LiveDot className="size-[0.6em]" /> Quiz{' '}
              {data.quiz.phase === 'ended' ? 'ended' : data.quiz.phase === 'open' ? 'open' : 'live'}
            </Chip>
          )}
          {data.games
            .filter((g) => g.status === 'live')
            .slice(0, 2)
            .map((g) => (
              <Chip key={g.id}>
                <LiveDot className="size-[0.6em]" /> {g.name}
              </Chip>
            ))}
          <Clock />
          {stale && presenter && (
            <span
              className="bg-coral size-[0.6em] rounded-full"
              title="Reconnecting"
              aria-label="Reconnecting"
            />
          )}
        </div>
      </header>

      <main className="relative min-h-0 flex-1 px-[3em] pb-[1.6em]">
        <LayoutGroup>
          <div className="grid h-full grid-cols-12 grid-rows-6 gap-[1.2em]">
            {CARDS.map((card) => (
              <motion.button
                key={card.id}
                type="button"
                layoutId={reduce ? undefined : `card-${card.id}`}
                onClick={() => setOpen(card.id)}
                className={cn(
                  'group hover:ring-plum relative flex flex-col overflow-hidden rounded-[2em] p-[2em] text-left ring-1 transition-[box-shadow] duration-300',
                  card.tile,
                  card.id === 'quiz' && data.quiz.phase !== 'locked'
                    ? 'bg-plum text-ink ring-plum'
                    : 'bg-prussian ring-grape',
                )}
                style={{ visibility: open === card.id ? 'hidden' : 'visible' }}
              >
                <span className="flex items-start justify-between">
                  <span className="font-display text-[2em] leading-none font-bold tracking-tight">
                    {card.title}
                  </span>
                  <kbd className="rounded-[0.5em] px-[0.6em] py-[0.2em] font-mono text-[1em] opacity-60 ring-1 ring-current">
                    {card.key}
                  </kbd>
                </span>
                <div className="mt-[1.2em] min-h-0 flex-1">
                  <CardBody id={card.id} data={data} mode="tile" studentUrl={studentUrl} />
                </div>
              </motion.button>
            ))}
          </div>

          <AnimatePresence>
            {open && (
              <motion.section
                key={open}
                layoutId={reduce ? undefined : `card-${open}`}
                transition={{ type: 'spring', stiffness: 220, damping: 30 }}
                className={cn(
                  'absolute inset-x-[3em] top-0 bottom-[1.6em] z-10 flex flex-col overflow-hidden rounded-[2em] p-[2.6em] ring-1',
                  open === 'quiz' && data.quiz.phase !== 'locked' && data.quiz.phase !== 'ended'
                    ? 'bg-plum text-ink ring-plum'
                    : 'bg-prussian ring-grape',
                )}
                aria-label={CARDS.find((c) => c.id === open)?.title}
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { delay: 0.15 } }}
                  exit={{ opacity: 0 }}
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <div className="flex items-center justify-between">
                    <h1 className="font-display text-[3.2em] leading-none font-black tracking-tight">
                      {CARDS.find((c) => c.id === open)?.title}
                    </h1>
                    <button
                      type="button"
                      onClick={() => setOpen(null)}
                      className="rounded-full px-[1.2em] py-[0.5em] text-[1.1em] font-semibold opacity-70 ring-1 ring-current transition-opacity hover:opacity-100"
                    >
                      Esc
                    </button>
                  </div>
                  <div className="mt-[2em] min-h-0 flex-1">
                    <CardBody
                      id={open}
                      data={data}
                      mode="full"
                      studentUrl={studentUrl}
                      presenter={Boolean(presenter)}
                    />
                  </div>
                </motion.div>
              </motion.section>
            )}
          </AnimatePresence>
        </LayoutGroup>

        <AnimatePresence>
          {spotlight && (
            <motion.div
              key={spotlight.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-ink/95 absolute inset-0 z-20 grid place-items-center px-[8em]"
            >
              <motion.figure
                initial={{ y: 40, filter: 'blur(12px)' }}
                animate={{ y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              >
                <blockquote className="font-display text-petal text-[4.6em] leading-[1.08] font-bold tracking-tight text-balance">
                  “{spotlight.body}”
                </blockquote>
                <figcaption className="text-plum mt-[1em] text-[2em]">
                  — {spotlight.name ?? 'Anonymous'}
                </figcaption>
              </motion.figure>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Marquee
        items={top}
        speed={55}
        reverse
        className="bg-prussian font-display text-petal h-[3em] shrink-0 text-[1.2em] font-semibold tracking-[0.06em]"
        separator={<Star className="text-plum size-[0.6em]" />}
      />

      {presenter && (
        <PresenterBar
          data={data}
          quizzes={quizzes}
          name={presenter.name}
          rotate={rotate}
          onRotate={setRotate}
          spotlightId={spotlight?.id ?? null}
        />
      )}
      <LoginDialog
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        signedIn={Boolean(presenter)}
      />
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-prussian ring-grape flex items-center gap-[0.5em] rounded-full px-[1em] py-[0.4em] text-[1.1em] font-semibold ring-1">
      {children}
    </span>
  );
}

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  return (
    <time className="tabular font-mono text-[1.6em] font-bold" suppressHydrationWarning>
      {now
        ? now.toLocaleTimeString('en-GB', {
            timeZone: 'Asia/Karachi',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '--:--'}
    </time>
  );
}
