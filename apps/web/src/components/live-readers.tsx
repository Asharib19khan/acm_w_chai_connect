'use client';

import { AnimatePresence, motion } from 'motion/react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { world } from '@/lib/pet-world';

interface Other {
  k: string;
  pos: number;
}

function tabId(): string {
  try {
    const have = sessionStorage.getItem('cc_tab');
    if (have) return have;
    const id = Math.random().toString(36).slice(2, 14).padEnd(10, '0');
    sessionStorage.setItem('cc_tab', id);
    return id;
  } catch {
    return Math.random().toString(36).slice(2, 14).padEnd(10, '0');
  }
}

/**
 * "3 others reading this": a live pill bottom-right, plus a thin rail on the right edge where a pink
 * dot shows how far down the page each other reader is right now, sliding as they scroll. Your own
 * position is the black ring. No names, nothing identifying.
 */
export function LiveReaders() {
  const path = usePathname();
  const [others, setOthers] = useState<Other[]>([]);
  const [me, setMe] = useState(0);
  const id = useRef('');

  useEffect(() => {
    id.current = tabId();
    const pos = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      return max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    };
    let alive = true;
    let timer = 0;
    const beat = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const res = await fetch('/api/presence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id.current, page: path, pos: pos() }),
          });
          if (res.ok && alive) {
            const data = (await res.json()) as { others: Other[] | null };
            if (data.others) {
              setOthers(data.others);
              world.othersReading = data.others.length;
            }
          }
        } catch {
          // offline: keep the last picture
        }
      }
      if (alive) timer = window.setTimeout(beat, 5000);
    };
    beat();
    const onScroll = () => setMe(pos());
    addEventListener('scroll', onScroll, { passive: true });
    const bye = () => navigator.sendBeacon?.(`/api/presence?id=${id.current}`);
    addEventListener('pagehide', bye);
    return () => {
      alive = false;
      clearTimeout(timer);
      removeEventListener('scroll', onScroll);
      removeEventListener('pagehide', bye);
    };
  }, [path]);

  if (path.startsWith('/quiz')) return null;
  const n = others.length;

  return (
    <>
      {/* Where everyone is on this page. */}
      <div aria-hidden className="pointer-events-none fixed top-24 right-1 bottom-20 z-[72] w-2">
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[#000]/15" />
        <span
          className="absolute left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#000] bg-white"
          style={{ top: `${me * 100}%` }}
        />
        <AnimatePresence>
          {others.map((o) => (
            <motion.span
              key={o.k}
              className="bg-accent absolute left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_8px_#ff4fd8]"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1, top: `${o.pos * 100}%` }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ top: { duration: 4.5, ease: 'easeInOut' }, default: { duration: 0.4 } }}
            />
          ))}
        </AnimatePresence>
      </div>

      <div
        aria-live="polite"
        className="font-display fixed right-4 bottom-4 z-[72] flex items-center gap-2 border-2 border-[#000] bg-white px-3 py-1.5 text-[0.7rem] font-black tracking-[0.08em] text-[#000] uppercase shadow-[3px_3px_0_0_#ff4fd8]"
      >
        <span className="relative flex size-2.5">
          {n > 0 && <span className="bg-accent absolute inset-0 animate-ping rounded-full" />}
          <span
            className={`relative size-2.5 rounded-full ${n > 0 ? 'bg-accent' : 'bg-[#000]/30'}`}
          />
        </span>
        {n === 0 ? 'Just you here. VIP.' : `${n} other${n === 1 ? '' : 's'} reading this`}
      </div>
    </>
  );
}
