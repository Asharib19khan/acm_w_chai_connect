'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const SEEN_KEY = 'cc_intro_seen';

const IntroDone = createContext(true);

/** True once the startup animation has finished (or was skipped). Page entrances wait for it. */
export function useIntroDone() {
  return useContext(IntroDone);
}

/**
 * Startup animation, once per browser session: "Ek chai!", the order you shout at a Karachi
 * dhaba. Tape slaps across, EK and CHAI slam down, a date sticker stamps on, a CONNECT tape
 * runs the other way, then everything is ripped off to open the site. Tap anywhere to skip.
 * Skipped on the quiz page and under prefers-reduced-motion. Only transforms and opacity move,
 * so it stays smooth on phones. The overlay is in the server HTML, so the page never flashes
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
    const id = setTimeout(() => setPhase('done'), 2400);
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
            {/* The paper the order is stuck to: ripped upward last, opening the site. */}
            <motion.div
              className="bg-canvas absolute inset-0"
              exit={
                skipped
                  ? undefined
                  : { y: '-100%', transition: { duration: 0.6, delay: 0.22, ease: [0.76, 0, 0.24, 1] } }
              }
            />
            {phase === 'play' && <IntroArt />}
          </motion.div>
        )}
      </AnimatePresence>
    </IntroDone.Provider>
  );
}

const SLAM = { type: 'spring', stiffness: 700, damping: 26, mass: 0.9 } as const;
const RIP = { duration: 0.55, ease: [0.55, 0, 0.9, 0.4] } as const;

function Tape({
  text,
  className,
  rotate,
  delay,
  from,
  exitRotate,
  reverse = false,
}: {
  text: string;
  className: string;
  rotate: number;
  delay: number;
  from: 'left' | 'right';
  exitRotate: number;
  reverse?: boolean;
}) {
  const run = Array.from({ length: 8 }, () => text).join('  •  ');
  return (
    <motion.div
      className={`absolute -inset-x-[15%] flex h-[clamp(2.6rem,11vw,4.5rem)] items-center overflow-hidden shadow-[0_6px_0_rgb(0_0_0/0.18)] ${className}`}
      style={{ rotate, transformOrigin: from === 'left' ? '0% 50%' : '100% 50%' }}
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ duration: 0.22, delay, ease: [0.2, 0.9, 0.3, 1.2] }}
      exit={{ y: '-130vh', rotate: exitRotate, transition: RIP }}
    >
      <div
        className={`cc-tape-run font-mono text-[clamp(0.8rem,3.4vw,1.15rem)] font-bold tracking-[0.25em] whitespace-nowrap uppercase ${reverse ? 'cc-tape-run-rev' : ''}`}
      >
        {run} • {run}
      </div>
    </motion.div>
  );
}

function IntroArt() {
  return (
    <motion.div className="absolute inset-0 overflow-hidden" exit={{ transition: { duration: 0.8 } }}>
      <Tape
        text="ACM-W presents"
        className="bg-accent text-on-accent top-[17%]"
        rotate={-7}
        delay={0.05}
        from="left"
        exitRotate={-28}
      />

      <div className="font-hero absolute inset-x-0 top-1/2 -translate-y-1/2 px-[6vw] leading-[0.8] font-extrabold tracking-[-0.06em] uppercase">
        <motion.div
          className="text-fg w-fit text-[clamp(8rem,60vw,26rem)]"
          initial={{ scale: 2.6, rotate: -14, opacity: 0 }}
          animate={{ scale: 1, rotate: -4, opacity: 1 }}
          transition={{ ...SLAM, delay: 0.32 }}
          exit={{ y: '120vh', rotate: -30, transition: { ...RIP, delay: 0.05 } }}
        >
          Ek
        </motion.div>
        <motion.div
          className="text-accent -mt-[4vw] ml-[1vw] w-fit text-[clamp(5rem,33vw,17rem)] [text-shadow:0.06em_0.06em_0_#000]"
          initial={{ scale: 2.6, rotate: 12, opacity: 0 }}
          animate={{ scale: 1, rotate: 3, opacity: 1 }}
          transition={{ ...SLAM, delay: 0.62 }}
          exit={{ y: '120vh', rotate: 24, transition: { ...RIP, delay: 0.1 } }}
        >
          Chai!
        </motion.div>
      </div>

      {/* Date sticker, stamped on at an angle. */}
      <motion.div
        className="bg-fg text-accent absolute top-[24%] right-[7vw] grid size-[clamp(5.5rem,24vw,9rem)] place-items-center rounded-full text-center font-mono leading-tight font-bold shadow-[0_5px_0_var(--cc-brand)]"
        initial={{ scale: 0, rotate: -40 }}
        animate={{ scale: 1, rotate: 14 }}
        transition={{ type: 'spring', stiffness: 520, damping: 14, delay: 0.98 }}
        exit={{ y: '-120vh', rotate: 90, transition: RIP }}
      >
        <span className="text-[clamp(1.2rem,5.6vw,2.2rem)] tracking-tight">27.11</span>
        <span className="-mt-3 text-[clamp(0.5rem,2.1vw,0.75rem)] tracking-[0.3em] text-white">FAST·KHI</span>
      </motion.div>

      <Tape
        text="Connect"
        className="bg-fg text-accent bottom-[15%]"
        rotate={6}
        delay={1.2}
        from="right"
        exitRotate={22}
        reverse
      />
    </motion.div>
  );
}
