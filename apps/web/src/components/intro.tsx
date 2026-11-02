'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Scramble } from './scramble';

const SEEN_KEY = 'cc_intro_seen';

const IntroDone = createContext(true);

/** True once the startup animation has finished (or was skipped). Page entrances wait for it. */
export function useIntroDone() {
  return useContext(IntroDone);
}

/**
 * Startup animation, once per browser session: the name decrypts on black, a hairline draws
 * across, and the screen splits open. Tap anywhere to skip. Skipped entirely on the quiz page
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
    const id = setTimeout(() => setPhase('done'), 2200);
    return () => clearTimeout(id);
  }, [phase]);

  return (
    <IntroDone.Provider value={phase === 'done'}>
      {children}
      <AnimatePresence custom={skipped}>
        {phase !== 'done' && (
          <motion.div
            key="intro"
            className="fixed inset-0 z-[90] cursor-pointer"
            exit={{ opacity: skipped ? 0 : 1, transition: { duration: skipped ? 0.15 : 0.9 } }}
            onClick={() => setPhase('done')}
            aria-hidden
          >
            {/* Two black halves that split apart to open the site. */}
            {(['top', 'bottom'] as const).map((side) => (
              <motion.div
                key={side}
                className={`bg-canvas absolute inset-x-0 h-1/2 ${side === 'top' ? 'top-0' : 'bottom-0'}`}
                exit={
                  skipped
                    ? undefined
                    : {
                        y: side === 'top' ? '-100%' : '100%',
                        transition: { duration: 0.85, ease: [0.76, 0, 0.24, 1] },
                      }
                }
              />
            ))}
            {phase === 'play' && <IntroArt />}
          </motion.div>
        )}
      </AnimatePresence>
    </IntroDone.Provider>
  );
}

function IntroArt() {
  return (
    <motion.div
      className="absolute inset-0 grid place-items-center px-4"
      exit={{ opacity: 0, scale: 1.08, transition: { duration: 0.35 } }}
    >
      <div className="flex w-full max-w-5xl flex-col items-start">
        <Scramble
          text="CHAI CONNECT"
          duration={1100}
          className="font-display text-fg text-[clamp(2.6rem,11.5vw,9rem)] leading-[0.9] font-black tracking-[-0.05em]"
        />
        <motion.div
          className="bg-accent mt-5 h-2 w-full origin-left"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.5, delay: 0.25, ease: [0.65, 0, 0.35, 1] }}
        />
        <div className="text-accent mt-4 flex w-full justify-between font-mono text-[0.7rem] tracking-[0.3em] uppercase sm:text-xs">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
          >
            ACM-W
          </motion.span>
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
          >
            27.11.2026
          </motion.span>
        </div>
      </div>
    </motion.div>
  );
}
