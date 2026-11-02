'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { petFeet } from '@/lib/pet-world';
import { playSound } from '@/lib/sound';
import { startTilt, tilt } from '@/lib/tilt';
import { useIntroDone } from './intro';

/**
 * The home hero title: solid heavy letters with a pink 3D edge whose direction follows the phone's
 * tilt (or the mouse). Each letter drops in, bounces when tapped, and dips under the pet's feet
 * when it walks across. Real text for screen readers and search.
 */
export function HeroTitle({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const reduce = useReducedMotion();
  const ready = useIntroDone();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduce) return;
    startTilt();
    const letters = Array.from(el.querySelectorAll<HTMLSpanElement>('[data-l]'));
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      el.style.setProperty('--ex', (-tilt.x * 1.1).toFixed(2));
      el.style.setProperty('--ey', (1.2 - tilt.y * 0.5).toFixed(2));
      for (const l of letters) {
        const r = l.getBoundingClientRect();
        const on =
          petFeet.x > r.left &&
          petFeet.x < r.right &&
          Math.abs(petFeet.y - (r.top + r.height * 0.12)) < 18;
        l.style.setProperty('--press', on ? '1' : '0');
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduce]);

  let n = 0;
  return (
    <h1
      ref={ref}
      data-pet-play
      aria-label={lines.join(' ')}
      className="cc-hero font-hero leading-[0.84] tracking-[-0.05em] uppercase select-none"
    >
      {lines.map((word, w) => (
        <span
          key={word}
          aria-hidden
          className={`block whitespace-nowrap ${
            w === 0
              ? 'text-[clamp(4.6rem,27vw,15rem)] text-[#000]'
              : 'text-accent text-[clamp(3.2rem,18.4vw,10.5rem)]'
          }`}
        >
          {word.split('').map((ch) => {
            const i = n++;
            return (
              <motion.span
                key={i}
                data-l
                className="cc-hero-letter inline-block"
                initial={reduce ? false : { y: '-120%', rotate: (i % 2 ? 1 : -1) * 18, opacity: 0 }}
                animate={ready ? { y: 0, rotate: 0, opacity: 1 } : undefined}
                transition={{ type: 'spring', stiffness: 520, damping: 17, delay: 0.15 + i * 0.05 }}
                onPointerDown={(e) => {
                  const t = e.currentTarget;
                  t.classList.remove('cc-boing');
                  void t.offsetWidth;
                  t.classList.add('cc-boing');
                  playSound('pop');
                }}
              >
                {ch}
              </motion.span>
            );
          })}
        </span>
      ))}
    </h1>
  );
}
