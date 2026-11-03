'use client';

import { useEffect } from 'react';
import { onScrollWake, scroll, startScrollSpeed } from '@/lib/scroll-speed';

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
    let shownW = '';
    let shownS = '';
    let raf = 0;
    const tick = () => {
      // 0 at rest, 1 at a fast flick (~2500 px/s).
      const t = Math.min(1, scroll.speed / 2500);
      const targetW = 640 + t * 260;
      const targetS = -scroll.direction * t * 6;
      wght += (targetW - wght) * 0.12;
      skew += (targetS - skew) * 0.12;
      // Write only real changes: every write restyles the whole page.
      const w = String(Math.round(wght / 10) * 10);
      const k = `${skew.toFixed(1)}deg`;
      if (w !== shownW) root.style.setProperty('--cc-wght', (shownW = w));
      if (k !== shownS) root.style.setProperty('--cc-skew', (shownS = k));
      // Settled at rest: sleep until the next scroll.
      if (scroll.speed === 0 && Math.abs(wght - 640) < 5 && Math.abs(skew) < 0.05) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const stop = onScrollWake(wake);
    return () => {
      stop();
      cancelAnimationFrame(raf);
    };
  }, []);
  return null;
}
