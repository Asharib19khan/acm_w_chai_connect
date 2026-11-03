'use client';

/*
 * Shared "tilt": how the phone is tilted (or, on a computer, where the mouse is), as x and y from
 * -1 to 1. Smoothed so it glides. iPhones only share motion after a permission prompt, which must
 * come from a tap, so we ask on the first tap anywhere.
 */
export const tilt = { x: 0, y: 0 };
const target = { x: 0, y: 0 };
let started = false;
let gyro = false;

type IOSOrientation = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };

function onOrientation(e: DeviceOrientationEvent) {
  if (e.gamma == null || e.beta == null) return;
  gyro = true;
  // gamma: left/right, beta: front/back (phone held upright is about 45-60 degrees).
  target.x = Math.max(-1, Math.min(1, e.gamma / 30));
  target.y = Math.max(-1, Math.min(1, (e.beta - 50) / 30));
  wake();
}

function onMouse(e: PointerEvent) {
  if (gyro || e.pointerType !== 'mouse') return;
  target.x = (e.clientX / innerWidth) * 2 - 1;
  target.y = (e.clientY / innerHeight) * 2 - 1;
  wake();
}

function askPermission() {
  const DO = (window as unknown as { DeviceOrientationEvent?: IOSOrientation })
    .DeviceOrientationEvent;
  if (DO?.requestPermission) {
    DO.requestPermission()
      .then((r) => r === 'granted' && addEventListener('deviceorientation', onOrientation))
      .catch(() => {});
  }
}

export function startTilt() {
  if (started || typeof window === 'undefined') return;
  started = true;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const DO = (window as unknown as { DeviceOrientationEvent?: IOSOrientation })
    .DeviceOrientationEvent;
  if (DO && !DO.requestPermission) addEventListener('deviceorientation', onOrientation);
  if (DO?.requestPermission) addEventListener('pointerdown', askPermission, { once: true });
  addEventListener('pointermove', onMouse, { passive: true });
  wake();
}

// The smoothing loop sleeps once the tilt has caught up and wakes on the next movement.
let running = false;
function step() {
  tilt.x += (target.x - tilt.x) * 0.08;
  tilt.y += (target.y - tilt.y) * 0.08;
  if (Math.abs(target.x - tilt.x) < 0.002 && Math.abs(target.y - tilt.y) < 0.002) {
    running = false;
    return;
  }
  requestAnimationFrame(step);
}
function wake() {
  if (running) return;
  running = true;
  requestAnimationFrame(step);
}
