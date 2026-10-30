'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const SEEN_KEY = 'cc_intro_seen';
const ease = [0.16, 1, 0.3, 1] as const;

const IntroDone = createContext(true);

/** True once the startup animation has finished (or was skipped). Page entrances wait for it. */
export function useIntroDone() {
  return useContext(IntroDone);
}

/**
 * Startup animation, once per browser session: an empty glass fills with chai, steam rises, the
 * name settles in, and the curtain lifts. Tap anywhere to skip. Skipped entirely on the quiz page
 * and under prefers-reduced-motion. The overlay is in the server HTML, so the page never flashes
 * underneath it first.
 */
export function IntroGate({ children }: { children: ReactNode }) {
  const path = usePathname();
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<'pending' | 'play' | 'done'>('pending');
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === '1';
    } catch {
      // storage blocked: just play it
    }
    const skip = seen || reduce || path.startsWith('/quiz');
    const id = setTimeout(() => {
      setSkipped(skip);
      setPhase(skip ? 'done' : 'play');
    }, 0);
    return () => clearTimeout(id);
    // Decide once, on first load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'play') return;
    try {
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      // ignore
    }
    const id = setTimeout(() => setPhase('done'), 2500);
    return () => clearTimeout(id);
  }, [phase]);

  return (
    <IntroDone.Provider value={phase === 'done'}>
      {children}
      <AnimatePresence custom={skipped}>
        {phase !== 'done' && (
          <motion.div
            key="intro"
            className="bg-canvas fixed inset-0 z-[90] grid cursor-pointer place-items-center"
            variants={{
              exit: (instant: boolean) =>
                instant
                  ? { opacity: 0, transition: { duration: 0.15 } }
                  : { y: '-100%', transition: { duration: 0.75, ease: [0.76, 0, 0.24, 1] } },
            }}
            exit="exit"
            onClick={() => setPhase('done')}
            aria-hidden
          >
            {phase === 'play' && <IntroArt />}
            <motion.div
              className="bg-accent absolute inset-x-0 bottom-0 h-2 origin-left"
              initial={{ scaleX: 0 }}
              animate={phase === 'play' ? { scaleX: 1 } : {}}
              transition={{ duration: 2.3, ease: 'linear' }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </IntroDone.Provider>
  );
}

function IntroArt() {
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 64 72" className="h-32 w-auto overflow-visible sm:h-40" fill="none">
        <defs>
          <clipPath id="cc-intro-glass">
            <path d="M13.2 30h37.6l-5.4 36a3 3 0 0 1-3 2.6H21.6a3 3 0 0 1-3-2.6L13.2 30Z" />
          </clipPath>
        </defs>
        {[
          { x: 22, delay: 1.05, drift: -3 },
          { x: 32, delay: 1.25, drift: 4 },
          { x: 42, delay: 1.45, drift: -2 },
        ].map((w) => (
          <motion.path
            key={w.x}
            d={`M${w.x} 22c-4-5 4-8 0-13s4-7 0-9`}
            stroke="var(--cc-accent-strong)"
            strokeWidth="2.6"
            strokeLinecap="round"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: [0, 1, 0.9], y: [8, -2, -6], x: [0, w.drift / 2, w.drift] }}
            transition={{ duration: 1.1, delay: w.delay, ease }}
          />
        ))}
        <motion.path
          d="M10 28h44l-5.5 38a5 5 0 0 1-5 4.3H20.5a5 5 0 0 1-5-4.3L10 28Z"
          fill="var(--cc-petal)"
          stroke="var(--cc-ink)"
          strokeWidth="2.4"
          strokeLinejoin="round"
          initial={{ opacity: 0, scale: 0.85, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        />
        <g clipPath="url(#cc-intro-glass)">
          <motion.rect
            x="8"
            y="30"
            width="48"
            height="40"
            fill="var(--cc-plum)"
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.75, delay: 0.35, ease: [0.33, 1, 0.68, 1] }}
            style={{ transformBox: 'fill-box', transformOrigin: 'bottom' }}
          />
        </g>
        <motion.path
          d="M8 28h48"
          stroke="var(--cc-ink)"
          strokeWidth="3.2"
          strokeLinecap="round"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        />
      </svg>
      <p className="font-display text-fg mt-6 flex overflow-hidden text-[clamp(2.2rem,10vw,3.6rem)] leading-none font-black tracking-[-0.04em]">
        {'Chai Connect'.split('').map((ch, i) => (
          <motion.span
            key={i}
            className={ch === ' ' ? 'w-[0.3em]' : i > 4 ? 'text-accent-strong' : undefined}
            initial={{ y: '110%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.6, delay: 1.0 + i * 0.035, ease }}
          >
            {ch === ' ' ? '\u00a0' : ch}
          </motion.span>
        ))}
      </p>
      <motion.p
        className="text-fg-muted mt-4 text-sm font-medium tracking-[0.2em] uppercase"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.6 }}
      >
        ACM-W · 25 November
      </motion.p>
    </div>
  );
}
