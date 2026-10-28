'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

/** One authored entrance: the title rises out of a mask, like steam settling into letters. */
export function HeroReveal({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { y: 40, opacity: 0, filter: 'blur(14px)' }}
      animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
      transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
