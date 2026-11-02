'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { playSound, unlockSound } from '@/lib/sound';

/** Site-wide sounds: a tick on every button or link press, a whoosh on every page change. */
export function SoundWiring() {
  const path = usePathname();
  const first = useRef(true);

  useEffect(() => {
    const down = (e: PointerEvent) => {
      unlockSound();
      const el = (e.target as HTMLElement | null)?.closest('a, button, [role="radio"], label');
      if (el) playSound('tick');
    };
    document.addEventListener('pointerdown', down, { passive: true });
    return () => document.removeEventListener('pointerdown', down);
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    playSound('whoosh');
  }, [path]);

  return null;
}
