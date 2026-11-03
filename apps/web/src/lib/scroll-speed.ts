'use client';

/*
 * Shared, smoothed scroll speed in pixels per second (always positive). One listener for the
 * whole site: the breathing headings and the narrator both read it.
 */
export const scroll = { speed: 0, direction: 0 as -1 | 0 | 1 };
let started = false;

const wakers = new Set<() => void>();
/** Called when scrolling starts after a quiet spell, so loops that read `scroll` can wake up. */
export function onScrollWake(fn: () => void): () => void {
  wakers.add(fn);
  return () => wakers.delete(fn);
}

export function startScrollSpeed() {
  if (started || typeof window === 'undefined') return;
  started = true;
  let lastY = scrollY;
  let lastT = performance.now();
  let running = false;
  const tick = (t: number) => {
    const dt = Math.max(1, t - lastT);
    const dy = scrollY - lastY;
    const instant = (Math.abs(dy) / dt) * 1000;
    // Rise fast, fall slowly: it feels like momentum.
    const k = instant > scroll.speed ? 0.35 : 0.06;
    scroll.speed += (instant - scroll.speed) * k;
    if (dy !== 0) scroll.direction = dy > 0 ? 1 : -1;
    lastY = scrollY;
    lastT = t;
    // Sleep once the page is still; the next scroll wakes it.
    if (dy === 0 && scroll.speed < 1) {
      scroll.speed = 0;
      running = false;
      return;
    }
    requestAnimationFrame(tick);
  };
  addEventListener(
    'scroll',
    () => {
      if (running) return;
      running = true;
      lastY = scrollY;
      lastT = performance.now();
      requestAnimationFrame(tick);
      wakers.forEach((w) => w());
    },
    { passive: true },
  );
}
