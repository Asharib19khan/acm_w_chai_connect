'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { PulseJoin } from '@chai/db';
import { usePulse } from '@/lib/pulse';
import { playSound } from '@/lib/sound';
import { Burst } from './loud';

const DEPT_NAMES: Record<string, string> = {
  AF: 'Accounting & Finance',
  AI: 'AI',
  BA: 'Business Analytics',
  BBA: 'BBA',
  CE: 'Computer Engineering',
  CS: 'CS',
  CY: 'Cyber Security',
  DS: 'Data Science',
  EE: 'EE',
  FT: 'FinTech',
  SE: 'SE',
  GRAD: 'grad',
};

/**
 * "A CS student just joined Hide & Seek." One pop-up at a time, bottom-left, for sign-ups that
 * happen while the page is open (plus the latest one if it was in the last two minutes).
 * Never a name, a roll number or a total.
 */
export function JoinToasts() {
  const { joins } = usePulse();
  const seen = useRef<Set<string> | null>(null);
  const queue = useRef<PulseJoin[]>([]);
  const [current, setCurrent] = useState<PulseJoin | null>(null);

  useEffect(() => {
    if (!joins.length && seen.current) return;
    if (!seen.current) {
      seen.current = new Set(joins.map((j) => j.key));
      const fresh = joins[0];
      if (fresh && Date.now() - Date.parse(fresh.at) < 120_000) queue.current.push(fresh);
    } else {
      for (const j of [...joins].reverse()) {
        if (!seen.current.has(j.key)) {
          seen.current.add(j.key);
          queue.current.push(j);
        }
      }
    }
  }, [joins]);

  // Show queued joins one by one: 4.5 s each, a short gap between.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (current || !queue.current.length) return;
      const next = queue.current.shift()!;
      setCurrent(next);
      playSound('pop');
      window.setTimeout(() => setCurrent(null), 4500);
    }, 800);
    return () => clearInterval(id);
  }, [current]);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 left-4 z-[75] max-w-[calc(100vw-2rem)]"
    >
      <AnimatePresence>
        {current && (
          <motion.div
            key={current.key}
            initial={{ x: '-120%', rotate: -6 }}
            animate={{ x: 0, rotate: -2 }}
            exit={{ x: '-120%', rotate: -8 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            className="bg-accent font-display flex items-center gap-3 px-4 py-3 text-sm leading-tight font-black text-[#000] uppercase shadow-[4px_4px_0_0_#000]"
          >
            <Burst className="size-5 shrink-0 animate-spin [animation-duration:3s]" />
            <span>
              A {DEPT_NAMES[current.department] ?? current.department} student just joined{' '}
              <span className="underline decoration-[3px] underline-offset-2">{current.game}</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
