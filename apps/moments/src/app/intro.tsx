'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const SEEN_KEY = 'cc_moments_intro_seen';
const ease = [0.16, 1, 0.3, 1] as const;
const LENGTH_MS = 2600;

const IntroDone = createContext(true);

/** True once the startup animation has finished (or was skipped). The hero waits for it. */
export function useIntroDone() {
  return useContext(IntroDone);
}

/**
 * Startup animation, once per browser session: "ACM" rises in, the W waits as an dim, unlit letter,
 * then flickers on in pink like a neon sign, and the curtain lifts. Tap anywhere to skip. Skipped
 * under prefers-reduced-motion. The overlay is in the server HTML, so the page never flashes first.
 */
export function IntroGate({ children }: { children: ReactNode }) {
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
    const skip = seen || Boolean(reduce);
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
    const id = setTimeout(() => setPhase('done'), LENGTH_MS);
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
          </motion.div>
        )}
      </AnimatePresence>
    </IntroDone.Provider>
  );
}

function IntroArt() {
  return (
    <p className="font-display text-fg flex items-baseline text-[clamp(3rem,17vw,10rem)] leading-none font-black tracking-[-0.045em]">
      <span className="flex overflow-hidden pb-[0.08em]">
        {'ACM'.split('').map((ch, i) => (
          <motion.span
            key={ch}
            initial={{ y: '110%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 + i * 0.08, ease }}
          >
            {ch}
          </motion.span>
        ))}
      </span>
      <motion.span
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.35, delay: 0.55, ease }}
        style={{ originX: 0 }}
      >
        -
      </motion.span>
      {/* The W: an dim, unlit letter first, then it flickers on and stays lit in pink. */}
      <span className="relative">
        <motion.span
          className="text-fg"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.12, 0.12, 0] }}
          transition={{ duration: 1.5, times: [0, 0.2, 0.75, 1], delay: 0.6 }}
        >
          W
        </motion.span>
        <motion.span
          className="text-accent absolute inset-0"
          initial={{ opacity: 0, textShadow: '0 0 0px rgb(235 159 239 / 0)' }}
          animate={{
            opacity: [0, 1, 0.15, 1, 0.4, 1],
            textShadow: [
              '0 0 0px rgb(235 159 239 / 0)',
              '0 0 28px rgb(235 159 239 / 0.9)',
              '0 0 0px rgb(235 159 239 / 0)',
              '0 0 36px rgb(235 159 239 / 0.95)',
              '0 0 8px rgb(235 159 239 / 0.3)',
              '0 0 32px rgb(235 159 239 / 0.85)',
            ],
          }}
          transition={{ duration: 0.75, times: [0, 0.15, 0.3, 0.5, 0.65, 1], delay: 1.3 }}
        >
          W
        </motion.span>
      </span>
    </p>
  );
}
