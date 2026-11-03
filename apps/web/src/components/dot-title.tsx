'use client';

import { useEffect, useRef } from 'react';
import { petFeet } from '@/lib/pet-world';
import { startTilt, tilt } from '@/lib/tilt';
import { useIntroDone } from './intro';

/**
 * The home hero: the title drawn as a field of white dots. Dots fly in from scattered points once
 * the intro lifts, then scatter away from the finger or mouse and spring back. One canvas, no
 * libraries; it pauses off-screen and stands still under prefers-reduced-motion.
 */
export function DotTitle({ lines, label }: { lines: string[]; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const ready = useIntroDone();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !ready) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    startTilt();
    const dpr = Math.min(devicePixelRatio || 1, 2);

    let w = 0;
    let h = 0;
    let gap = 4;
    let radius = 1.2;
    // Per dot: home x, home y, x, y, velocity x, velocity y.
    let dots = new Float32Array(0);
    const pointer = { x: -9999, y: -9999, active: false };
    let raf = 0;
    let visible = true;

    const build = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Lay the words out off-screen, then sample their pixels into dots.
      const off = document.createElement('canvas');
      off.width = Math.round(w);
      off.height = Math.round(h);
      const o = off.getContext('2d', { willReadFrequently: true })!;
      const family = getComputedStyle(canvas).fontFamily;
      const lineH = h / lines.length;
      let size = lineH * 0.98;
      o.font = `900 ${size}px ${family}`;
      const widest = Math.max(...lines.map((l) => o.measureText(l).width));
      if (widest > w) size *= w / widest;
      o.font = `900 ${size}px ${family}`;
      o.fillStyle = '#fff';
      o.textBaseline = 'middle';
      lines.forEach((l, i) => o.fillText(l, 0, lineH * i + lineH / 2));

      gap = w < 520 ? 3 : w < 900 ? 4 : 5;
      radius = gap * 0.36;
      const data = o.getImageData(0, 0, off.width, off.height).data;
      const pts: number[] = [];
      for (let y = 0; y < off.height; y += gap) {
        for (let x = 0; x < off.width; x += gap) {
          if (data[(y * off.width + x) * 4 + 3]! > 128) {
            const sx = reduce ? x : Math.random() * w;
            const sy = reduce ? y : h + Math.random() * h * 0.6;
            pts.push(x, y, sx, sy, 0, 0);
          }
        }
      }
      dots = new Float32Array(pts);
    };

    // Skip redrawing once every dot is home and nothing is pushing them: same picture, no work.
    let settled = false;
    let lastTx = NaN;
    let lastTy = NaN;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      const tiltMoved = Math.abs(tilt.x - lastTx) > 0.001 || Math.abs(tilt.y - lastTy) > 0.001;
      if (settled && !tiltMoved && !pointer.active && !petFeet.kicking) return;
      lastTx = tilt.x;
      lastTy = tilt.y;
      ctx.clearRect(0, 0, w, h);
      const canvasRect = petFeet.kicking ? canvas.getBoundingClientRect() : null;
      let maxV = 0;
      const reach = Math.max(70, w * 0.11);
      const reach2 = reach * reach;
      for (let i = 0; i < dots.length; i += 6) {
        let x = dots[i + 2]!;
        let y = dots[i + 3]!;
        let vx = dots[i + 4]!;
        let vy = dots[i + 5]!;
        // Spring home. Tilt shifts each dot by a slightly different depth: a hologram shimmer.
        const depth = 3 + ((i / 6) % 5) * 2.2;
        vx += (dots[i]! + tilt.x * depth - x) * 0.055;
        vy += (dots[i + 1]! + tilt.y * depth - y) * 0.055;
        // The pet's feet kick dots too (canvas-local coordinates).
        if (canvasRect) {
          const r = canvasRect;
          const px = petFeet.x - r.left;
          const py = petFeet.y - r.top;
          const dx = x - px;
          const dy = y - py;
          const d2 = dx * dx + dy * dy;
          if (d2 < 900 && d2 > 0.01) {
            const d = Math.sqrt(d2);
            vx += (dx / d) * (1 - d / 30) * 7;
            vy += (dy / d) * (1 - d / 30) * 7 - 1.5;
          }
        }
        // Push away from the pointer.
        if (pointer.active) {
          const dx = x - pointer.x;
          const dy = y - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < reach2 && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const f = (1 - d / reach) * 9;
            vx += (dx / d) * f;
            vy += (dy / d) * f;
          }
        }
        vx *= 0.82;
        vy *= 0.82;
        x += vx;
        y += vy;
        dots[i + 2] = x;
        dots[i + 3] = y;
        dots[i + 4] = vx;
        dots[i + 5] = vy;
        maxV = Math.max(maxV, Math.abs(vx), Math.abs(vy));
      }
      // Two passes, one colour each: switching fillStyle per dot is slow on phones.
      const size = radius * 2;
      ctx.fillStyle = '#ff4fd8';
      for (let i = 0; i < dots.length; i += 6)
        if ((i / 6) % 9 !== 0) ctx.fillRect(dots[i + 2]! - radius, dots[i + 3]! - radius, size, size);
      ctx.fillStyle = '#000000';
      for (let i = 0; i < dots.length; i += 54) ctx.fillRect(dots[i + 2]! - radius, dots[i + 3]! - radius, size, size);
      settled = maxV < 0.01;
    };

    const move = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
      pointer.active = true;
    };
    const leave = () => {
      pointer.active = false;
    };

    let resizeTimer = 0;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(build, 150);
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
    });
    io.observe(canvas);

    // Wait for the display font so the dots trace the real letters.
    document.fonts.ready.then(() => {
      build();
      if (reduce) {
        ctx.fillStyle = '#ff4fd8';
        for (let i = 0; i < dots.length; i += 6)
          ctx.fillRect(dots[i]! - radius, dots[i + 1]! - radius, radius * 2, radius * 2);
        return;
      }
      raf = requestAnimationFrame(frame);
    });

    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', move, { passive: true });
    window.addEventListener('pointerup', leave);
    canvas.addEventListener('pointerleave', leave);
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      clearTimeout(resizeTimer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', move);
      window.removeEventListener('pointerup', leave);
      canvas.removeEventListener('pointerleave', leave);
      window.removeEventListener('resize', onResize);
    };
  }, [ready, lines]);

  return (
    <h1 className="relative">
      <span className="sr-only">{label}</span>
      <canvas
        ref={ref}
        aria-hidden
        className="font-display block aspect-[2.25/1] w-full touch-pan-y sm:aspect-[3.1/1]"
      />
    </h1>
  );
}
