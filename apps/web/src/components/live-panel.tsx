'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { nowAndNext } from '@/lib/agenda';
import { isEventDay, usePulse } from '@/lib/pulse';
import { Countdown } from './countdown';

/**
 * Before the event: the countdown. On 27 November (or whenever the quiz is live): a live panel with
 * the quiz banner, what's on now and next, and the questions currently up on the big screen.
 */
export function LiveOrCountdown() {
  const pulse = usePulse();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const live = now !== null && (isEventDay(now) || pulse.quizLive);
  if (!live) return <Countdown />;
  return <LivePanel now={now} />;
}

function LivePanel({ now }: { now: number }) {
  const { quizLive, questions } = usePulse();
  const { now: on, next } = nowAndNext(now);
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);
  const q = questions.length ? questions[i % questions.length] : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="bg-accent font-display flex items-center gap-2 px-3 py-1.5 text-sm font-black text-[#000] uppercase">
          <span className="relative flex size-2.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-[#000]" />
            <span className="relative size-2.5 rounded-full bg-[#000]" />
          </span>
          Live now
        </span>
        <span className="font-display text-xs font-black tracking-[0.25em] uppercase">
          Chai Connect is on
        </span>
      </div>

      {quizLive && (
        <Link
          href="/quiz"
          className="font-display flex items-center justify-between bg-[#000] px-5 py-4 text-[clamp(1.4rem,6vw,3rem)] leading-none font-black tracking-[-0.04em] text-[#ff4fd8] uppercase shadow-[6px_6px_0_0_#ff4fd8]"
        >
          The quiz is open. Jump in
          <span aria-hidden>→</span>
        </Link>
      )}

      {(on || next) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {on && (
            <AgendaCard
              label="Happening now"
              title={on.title}
              meta={`${on.start} to ${on.end}${on.place ? ` · ${on.place}` : ''}`}
              strong
            />
          )}
          {next && (
            <AgendaCard
              label="Up next"
              title={next.title}
              meta={`${next.start}${next.place ? ` · ${next.place}` : ''}`}
            />
          )}
        </div>
      )}

      {q && (
        <div className="border-fg relative overflow-hidden border-2 p-5">
          <p className="font-display mb-3 text-xs font-black tracking-[0.25em] uppercase">
            On the big screen
          </p>
          <AnimatePresence mode="wait">
            <motion.blockquote
              key={q.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="font-display text-[clamp(1.2rem,4.6vw,2.2rem)] leading-tight font-black tracking-[-0.03em]">
                “{q.body}”
              </p>
              <footer className="text-fg-muted mt-2 text-sm">{q.name ?? 'Anonymous'}</footer>
            </motion.blockquote>
          </AnimatePresence>
          <Link
            href="/ask"
            className="text-accent font-display mt-4 inline-block text-sm font-black uppercase underline underline-offset-4"
          >
            Ask yours
          </Link>
        </div>
      )}
    </div>
  );
}

function AgendaCard({
  label,
  title,
  meta,
  strong = false,
}: {
  label: string;
  title: string;
  meta: string;
  strong?: boolean;
}) {
  return (
    <div className={`p-4 ${strong ? 'bg-accent text-[#000]' : 'border-fg border-2'}`}>
      <p className="font-display text-xs font-black tracking-[0.25em] uppercase">{label}</p>
      <p className="font-display mt-2 text-xl leading-tight font-black uppercase">{title}</p>
      <p className="mt-1 text-sm opacity-75">{meta}</p>
    </div>
  );
}
