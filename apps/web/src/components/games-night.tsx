'use client';

import { AnimatePresence, motion } from 'motion/react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * The Games page goes dark: black and pink (html.cc-dark, see globals.css). When Chaiman calls it,
 * the Chai-signal (a spotlight with a cup-with-ears symbol) sweeps up into the sky behind the page.
 */
export function GamesNight() {
  const path = usePathname();
  const on = path.startsWith('/games');
  const [signal, setSignal] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('cc-dark', on);
    return () => document.documentElement.classList.remove('cc-dark');
  }, [on]);

  useEffect(() => {
    if (!on) return;
    let t = 0;
    const show = () => {
      setSignal(true);
      clearTimeout(t);
      t = window.setTimeout(() => setSignal(false), 4500);
    };
    addEventListener('cc:signal', show);
    return () => {
      removeEventListener('cc:signal', show);
      clearTimeout(t);
    };
  }, [on]);

  if (!on) return null;
  return (
    <AnimatePresence>
      {signal && (
        <motion.div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
        >
          <svg viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" className="size-full">
            <defs>
              <linearGradient id="cc-beam" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0" stopColor="#ff4fd8" stopOpacity="0.05" />
                <stop offset="1" stopColor="#ff4fd8" stopOpacity="0.32" />
              </linearGradient>
              <radialGradient id="cc-spot">
                <stop offset="0" stopColor="#ff4fd8" stopOpacity="0.55" />
                <stop offset="0.75" stopColor="#ff4fd8" stopOpacity="0.35" />
                <stop offset="1" stopColor="#ff4fd8" stopOpacity="0" />
              </radialGradient>
            </defs>
            <motion.g
              initial={{ rotate: -14 }}
              animate={{ rotate: 6 }}
              transition={{ duration: 4.5, ease: 'easeInOut' }}
              style={{ transformOrigin: '60px 800px' }}
            >
              <path d="M40 800 L80 800 L330 170 L210 130 Z" fill="url(#cc-beam)" />
              <ellipse cx="270" cy="150" rx="95" ry="70" fill="url(#cc-spot)" />
              {/* Cup with ears, in silhouette */}
              <g
                transform="translate(270 150) scale(1.5) translate(-30 -40)"
                fill="#000"
                opacity="0.85"
              >
                <path d="M17 23 L19.5 8.5 L25.5 22 Z" />
                <path d="M43 23 L40.5 8.5 L34.5 22 Z" />
                <path d="M12 22 H48 L44 60 a3 3 0 0 1 -3 2.6 H19 a3 3 0 0 1 -3 -2.6 Z" />
              </g>
            </motion.g>
          </svg>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
