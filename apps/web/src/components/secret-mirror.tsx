'use client';

import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { playSound } from '@/lib/sound';

/**
 * The secret: the front camera, rebuilt live as a halftone portrait of pink dots. Each dot is a
 * spring: drag through the face and the dots scatter, then rush back. "Save poster" exports a
 * story-sized image. Frames are read on the phone only and never uploaded or stored.
 */
export function SecretMirror({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'starting' | 'live' | 'denied'>('starting');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    playSound('shimmer');
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const video = document.createElement('video');
    video.playsInline = true;
    video.muted = true;
    const sample = document.createElement('canvas');
    const sctx = sample.getContext('2d', { willReadFrequently: true })!;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;

    // Dot grid + springs.
    let cols = 0;
    let rows = 0;
    let cell = 0;
    let offX = 0;
    let offY = 0;
    let dx = new Float32Array(0);
    let dy = new Float32Array(0);
    let vx = new Float32Array(0);
    let vy = new Float32Array(0);
    const finger = { x: -9999, y: -9999, down: false };

    const layout = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const w = innerWidth;
      const h = innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = w < 500 ? 64 : 96;
      cell = w / cols;
      rows = Math.ceil(h / cell);
      offX = 0;
      offY = 0;
      sample.width = cols;
      sample.height = rows;
      const n = cols * rows;
      // Start every dot scattered far away so the face assembles out of chaos.
      dx = new Float32Array(n).map(() => (Math.random() - 0.5) * w * 2);
      dy = new Float32Array(n).map(() => (Math.random() - 0.5) * h * 2);
      vx = new Float32Array(n);
      vy = new Float32Array(n);
    };

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const w = innerWidth;
      const h = innerHeight;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      if (video.readyState < 2) return;

      // Cover-fit the camera into the dot grid, mirrored like a selfie.
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const scale = Math.max(cols / vw, rows / vh);
      const sw = vw * scale;
      const sh = vh * scale;
      sctx.save();
      sctx.translate(cols, 0);
      sctx.scale(-1, 1);
      sctx.drawImage(video, (cols - sw) / 2, (rows - sh) / 2, sw, sh);
      sctx.restore();
      const px = sctx.getImageData(0, 0, cols, rows).data;

      const reach = Math.max(70, w * 0.18);
      const reach2 = reach * reach;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const p = i * 4;
          const lum = (0.299 * px[p]! + 0.587 * px[p + 1]! + 0.114 * px[p + 2]!) / 255;
          // Lift contrast so faces read clearly.
          const v = Math.min(1, Math.max(0, (lum - 0.12) * 1.5));
          const hx = offX + c * cell + cell / 2;
          const hy = offY + r * cell + cell / 2;

          if (finger.down) {
            const fx = hx + dx[i]! - finger.x;
            const fy = hy + dy[i]! - finger.y;
            const d2 = fx * fx + fy * fy;
            if (d2 < reach2 && d2 > 0.1) {
              const d = Math.sqrt(d2);
              const f = (1 - d / reach) * 14;
              vx[i]! += (fx / d) * f;
              vy[i]! += (fy / d) * f;
            }
          }
          vx[i] = (vx[i]! - dx[i]! * 0.06) * 0.86;
          vy[i] = (vy[i]! - dy[i]! * 0.06) * 0.86;
          dx[i]! += vx[i]!;
          dy[i]! += vy[i]!;

          const rad = (cell / 2) * (0.12 + v * 0.95);
          if (rad < 0.4) continue;
          ctx.fillStyle = v > 0.86 ? '#ffffff' : '#ff4fd8';
          ctx.beginPath();
          ctx.arc(hx + dx[i]!, hy + dy[i]!, rad, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const down = (e: PointerEvent) => {
      finger.down = true;
      finger.x = e.clientX;
      finger.y = e.clientY;
      playSound('whoosh');
    };
    const move = (e: PointerEvent) => {
      finger.x = e.clientX;
      finger.y = e.clientY;
      if (e.pointerType === 'mouse') finger.down = true;
    };
    const up = () => {
      finger.down = false;
    };

    layout();
    addEventListener('resize', layout);
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    canvas.addEventListener('pointerleave', up);

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 } }, audio: false })
      .then((s) => {
        if (stopped) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        video.srcObject = s;
        return video.play().then(() => {
          setStatus('live');
          playSound('boom');
        });
      })
      .catch(() => setStatus('denied'));
    draw();

    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', esc);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      removeEventListener('resize', layout);
      removeEventListener('pointerup', up);
      removeEventListener('keydown', esc);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const save = async () => {
    const src = canvasRef.current;
    if (!src) return;
    setSaving(true);
    playSound('success');
    // Story-sized poster: the live frame plus the event mark.
    const W = 1080;
    const H = 1920;
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const g = out.getContext('2d')!;
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    const s = Math.max(W / src.width, H / src.height);
    g.drawImage(
      src,
      (W - src.width * s) / 2,
      (H - src.height * s) / 2,
      src.width * s,
      src.height * s,
    );
    g.fillStyle = '#ff4fd8';
    g.fillRect(0, H - 260, W, 260);
    g.fillStyle = '#000';
    g.font = '900 92px "Unbounded", sans-serif';
    g.fillText('CHAI CONNECT', 60, H - 140);
    g.font = '800 40px "Unbounded", sans-serif';
    g.fillText('ACM-W  ·  27.11.2026  ·  FAST-NUCES', 60, H - 70);
    const blob = await new Promise<Blob | null>((r) => out.toBlob(r, 'image/png'));
    setSaving(false);
    if (!blob) return;
    const file = new File([blob], 'chai-connect-dots.png', { type: 'image/png' });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: 'Chai Connect' }).catch(() => {});
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
  };

  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Secret dot mirror"
      className="fixed inset-0 z-[99] bg-[#000]"
      initial={{ clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ clipPath: 'circle(150% at 50% 50%)' }}
      transition={{ duration: 0.9, ease: [0.76, 0, 0.24, 1] }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 touch-none" />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4 sm:p-6">
        <p className="font-display text-xs font-black tracking-[0.25em] text-[#ff4fd8] uppercase">
          You found it
        </p>
      </div>
      {status === 'starting' && (
        <p className="font-display absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-2xl font-black text-[#ff4fd8] uppercase">
          Look at your screen
        </p>
      )}
      {status === 'denied' && (
        <p className="font-display absolute inset-x-6 top-1/2 -translate-y-1/2 text-center text-xl font-black text-[#ff4fd8] uppercase">
          Allow the camera to see the secret. Nothing is recorded or uploaded.
        </p>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 p-4 sm:p-6">
        <button
          type="button"
          onClick={onClose}
          className="font-display px-4 py-3 text-sm font-black tracking-[0.15em] text-white uppercase"
        >
          Close
        </button>
        {status === 'live' && (
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="font-display bg-[#ff4fd8] px-5 py-3 text-sm font-black text-[#000] uppercase shadow-[5px_5px_0_0_#fff]"
          >
            {saving ? 'Saving…' : 'Save poster'}
          </button>
        )}
      </div>
      {status === 'live' && (
        <p className="font-display pointer-events-none absolute inset-x-0 bottom-20 text-center text-[0.65rem] font-black tracking-[0.25em] text-white/70 uppercase">
          Drag through your face
        </p>
      )}
    </motion.div>,
    document.body,
  );
}
