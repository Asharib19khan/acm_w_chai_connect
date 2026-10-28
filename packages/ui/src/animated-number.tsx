'use client';

import { animate, useMotionValue, useTransform, motion, useReducedMotion } from 'motion/react';
import { useEffect } from 'react';

/** Counts smoothly to a new value (scores, counters). */
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => Math.round(v).toLocaleString('en-US'));
  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: 0.8, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [value, mv, reduce]);
  return <motion.span className={className}>{text}</motion.span>;
}
