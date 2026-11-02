'use client';

/*
 * Shared, smoothed scroll speed in pixels per second (always positive). One listener for the
 * whole site: the breathing headings and the narrator both read it.
 */
export const scroll = { speed: 0, direction: 0 as -1 | 0 | 1 };
let started = false;

export function startScrollSpeed() {
  if (started || typeof window === 'undefined') return;
  started = true;
  let lastY = scrollY;
  let lastT = performance.now();
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
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
