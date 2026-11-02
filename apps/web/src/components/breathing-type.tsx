'use client';

import { useEffect } from 'react';
import { scroll, startScrollSpeed } from '@/lib/scroll-speed';

/**
 * Headings breathe with you: at rest they sit a little lighter; scroll and they swell to full
 * black weight, leaning slightly into the direction you're moving, then relax when you stop.
 * Drives two CSS variables on <html>; the styles live in globals.css (.cc-breathe and headings).
 */
export function BreathingType() {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    startScrollSpeed();
    const root = document.documentElement;
    let wght = 640;
    let skew = 0;
    let raf = 0;
    const tick = () => {
      // 0 at rest, 1 at a fast flick (~2500 px/s).
      const t = Math.min(1, scroll.speed / 2500);
      const targetW = 640 + t * 260;
      const targetS = -scroll.direction * t * 6;
      wght += (targetW - wght) * 0.12;
      skew += (targetS - skew) * 0.12;
      root.style.setProperty('--cc-wght', wght.toFixed(0));
      root.style.setProperty('--cc-skew', `${skew.toFixed(2)}deg`);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return null;
}
