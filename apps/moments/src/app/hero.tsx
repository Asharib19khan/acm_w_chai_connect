'use client';

import { MotionConfig, motion } from 'motion/react';
import { useIntroDone } from './intro';

const FRAMES = [
  { rotate: -9, x: -12, fill: 'bg-brand', delay: 0.05 },
  { rotate: 6, x: 10, fill: 'bg-accent', delay: 0.15 },
  { rotate: -2, x: 0, fill: 'bg-petal', delay: 0.25 },
];

/** Three prints dropping onto a table: the page's one visual, then the title. */
export function Hero() {
  const done = useIntroDone();
  return (
    <MotionConfig reducedMotion="user">
      <section className="grid gap-8 pt-10 pb-10 sm:grid-cols-[1fr_auto] sm:items-end sm:pt-16 sm:pb-14">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={done ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="font-display text-fg text-[clamp(2.8rem,12vw,5.4rem)] leading-[0.9] font-black tracking-[-0.045em]"
          >
            Share the
            <br />
            <span className="text-accent-strong">moment.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={done ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="text-fg-muted mt-5 max-w-md text-lg leading-relaxed"
          >
            We&apos;re here to record our journey together at{' '}
            <span className="text-fg font-semibold">
              ACM-<span className="text-accent">W</span>
            </span>
            . Remember YouTube Rewind? This one&apos;s ours. Drop your photos and videos here.
          </motion.p>
        </div>
        <div className="relative hidden h-40 w-36 sm:block" aria-hidden>
          {FRAMES.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: -40, rotate: 0 }}
              animate={done ? { opacity: 1, y: 0, rotate: f.rotate } : undefined}
              transition={{ type: 'spring', stiffness: 220, damping: 18, delay: f.delay }}
              style={{ x: f.x }}
              className="bg-surface ring-edge absolute inset-0 rounded-md p-2.5 pb-8 shadow-[0_18px_40px_-18px_var(--cc-shadow)] ring-1"
            >
              <div className={`${f.fill} size-full rounded-sm`} />
            </motion.div>
          ))}
        </div>
      </section>
    </MotionConfig>
  );
}
