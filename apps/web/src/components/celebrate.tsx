'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { playSound } from '@/lib/sound';
import { Burst } from './loud';
import { notify } from './notice-you';

const PIECES = Array.from({ length: 26 }, (_, i) => ({
  angle: (i / 26) * Math.PI * 2 + (i % 3) * 0.2,
  dist: 38 + ((i * 37) % 30),
  size: 14 + ((i * 13) % 26),
  spin: ((i * 71) % 360) - 180,
  black: i % 3 === 0,
}));

/**
 * Plays once when a form is sent: the screen floods pink, a giant word slams in, bursts fly out
 * from the centre, and the whole thing lifts away to reveal the confirmation underneath.
 */
export function Celebrate({ word, signal }: { word: string; signal?: string }) {
  const [show, setShow] = useState(true);
  const reduce = useReducedMotion();

  useEffect(() => {
    playSound('success');
    if (signal) notify(signal);
    const id = setTimeout(() => setShow(false), 1700);
    return () => clearTimeout(id);
    // Plays once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (reduce || typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div
          aria-hidden
          className="bg-accent fixed inset-0 z-[96] grid place-items-center overflow-hidden"
          initial={{ clipPath: 'circle(0% at 50% 60%)' }}
          animate={{ clipPath: 'circle(150% at 50% 60%)' }}
          exit={{ y: '-100%' }}
          transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
          onClick={() => setShow(false)}
        >
          {PIECES.map((p, i) => (
            <motion.span
              key={i}
              className="absolute top-1/2 left-1/2"
              style={{ color: p.black ? '#000' : '#fff' }}
              initial={{ x: 0, y: 0, scale: 0, rotate: 0 }}
              animate={{
                x: `${Math.cos(p.angle) * p.dist}vw`,
                y: `${Math.sin(p.angle) * p.dist}vh`,
                scale: 1,
                rotate: p.spin,
              }}
              transition={{ duration: 1.1, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="block" style={{ width: p.size, height: p.size }}>
                <Burst className="size-full" />
              </span>
            </motion.span>
          ))}
          <motion.p
            className="font-display relative px-4 text-center text-[clamp(3rem,15vw,12rem)] leading-none font-black tracking-[-0.06em] text-[#000] uppercase"
            initial={{ scale: 3, rotate: -12, opacity: 0 }}
            animate={{ scale: 1, rotate: -4, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 16, delay: 0.2 }}
          >
            {word}
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
