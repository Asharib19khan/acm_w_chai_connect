'use client';

import { useEffect, useRef, useState } from 'react';

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#*+<>';

/**
 * Text that "decrypts" into place: each letter cycles through random glyphs, then locks, left to
 * right. Screen readers get the real text straight away; reduced motion shows it immediately.
 */
export function Scramble({
  text,
  start = true,
  duration = 900,
  className,
}: {
  text: string;
  start?: boolean;
  duration?: number;
  className?: string;
}) {
  const [shown, setShown] = useState(text);
  const raf = useRef(0);

  useEffect(() => {
    if (!start) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const locked = Math.floor(p * text.length);
      let out = '';
      for (let i = 0; i < text.length; i++) {
        const ch = text[i]!;
        out += i < locked || ch === ' ' ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      setShown(out);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [text, start, duration]);

  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>{shown}</span>
    </span>
  );
}
