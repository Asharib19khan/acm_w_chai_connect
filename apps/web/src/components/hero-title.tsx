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
    // Letter boxes in page coordinates, measured only when the layout changes, never per frame
    // (measuring every frame forced the phone to redo layout 60 times a second).
    let boxes: { left: number; right: number; top: number }[] = [];
    const measure = () => {
      boxes = letters.map((l) => {
        const r = l.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top + scrollY + r.height * 0.12 };
      });
    };
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    const settle = setTimeout(measure, 2600); // after the letters finish dropping in
    const pressed = letters.map(() => false);
    let ex = '';
    let ey = '';
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const nx = (-tilt.x * 1.1).toFixed(2);
      const ny = (1.2 - tilt.y * 0.5).toFixed(2);
      if (nx !== ex) el.style.setProperty('--ex', (ex = nx));
      if (ny !== ey) el.style.setProperty('--ey', (ey = ny));
      const fy = petFeet.y + scrollY;
      for (let i = 0; i < letters.length; i++) {
        const b = boxes[i];
        const on = Boolean(b && petFeet.x > b.left && petFeet.x < b.right && Math.abs(fy - b.top) < 18);
        if (on !== pressed[i]) letters[i]!.style.setProperty('--press', (pressed[i] = on) ? '1' : '0');
      }
    };
    // Only animate while the title is on screen.
    const seen = new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf);
      if (e?.isIntersecting) {
        measure();
        raf = requestAnimationFrame(tick);
      }
    });
    seen.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      seen.disconnect();
      resize.disconnect();
      clearTimeout(settle);
    };
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
