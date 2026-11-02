'use client';

import { useSyncExternalStore } from 'react';
import type { StudentPulse } from '@chai/db';

const EMPTY: StudentPulse = { serverNow: 0, quizLive: false, questions: [], joins: [] };

/*
 * One shared poller for /api/pulse: however many components read it, the phone makes one request
 * every 8 seconds, and only while the tab is visible.
 */
let current = EMPTY;
const listeners = new Set<() => void>();
let timer = 0;

async function poll() {
  if (document.visibilityState === 'visible') {
    try {
      const res = await fetch('/api/pulse', { cache: 'no-store' });
      if (res.ok) {
        current = (await res.json()) as StudentPulse;
        listeners.forEach((l) => l());
      }
    } catch {
      // offline: keep the last pulse
    }
  }
  if (listeners.size) timer = window.setTimeout(poll, 8000);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) poll();
  return () => {
    listeners.delete(listener);
    if (!listeners.size) clearTimeout(timer);
  };
}

export function usePulse(): StudentPulse {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => EMPTY,
  );
}

/** Event day in Karachi: 27 November 2026. */
export function isEventDay(now = Date.now()): boolean {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(now);
  return day === '2026-11-27';
}
