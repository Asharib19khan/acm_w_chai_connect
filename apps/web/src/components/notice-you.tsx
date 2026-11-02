'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import { LINES, type LineGroup } from '@/lib/notice-lines';
import { scroll, startScrollSpeed } from '@/lib/scroll-speed';
import { MOOD_FOR, petSay } from '@/lib/pet-bus';

/*
 * "The website notices you": the brain behind the chai pet. It decides what the pet says, reacting
 * to how you use the site: the time, how often you visit, how fast you scroll, coming back to the tab, battery,
 * copying, rage taps, unfinished questions and more. Its memory lives only in this phone's
 * localStorage; nothing is sent anywhere.
 */
const MEMORY_KEY = 'cc_notice_v1';
const SESSION_KEY = 'cc_notice_session';
const EVENT_START = Date.parse('2026-11-27T09:00:00+05:00');
const GAP_MS = 20_000;
const MAX_PER_VISIT = 8;

interface Memory {
  visits: number;
  lastVisit: number;
  lastDay: string;
  said: string[];
  pages: string[];
  askDraft: string | null;
  secret: boolean;
}

function readMemory(): Memory {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    if (raw)
      return { said: [], pages: [], askDraft: null, secret: false, ...JSON.parse(raw) } as Memory;
  } catch {
    // storage blocked
  }
  return {
    visits: 0,
    lastVisit: 0,
    lastDay: '',
    said: [],
    pages: [],
    askDraft: null,
    secret: false,
  };
}

function writeMemory(m: Memory) {
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(m));
  } catch {
    // ignore
  }
}

const karachi = (opts: Intl.DateTimeFormatOptions, t = Date.now()) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', ...opts }).format(t);

function fill(text: string, vars: Record<string, string | number>) {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

let arrival: {
  m: Memory;
  firstLoadThisSession: boolean;
  gapDays: number;
  prevDay: string;
  today: string;
  now: number;
} | null = null;

function arrive() {
  const m = readMemory();
  let firstLoadThisSession = false;
  try {
    firstLoadThisSession = !sessionStorage.getItem(SESSION_KEY);
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    firstLoadThisSession = true;
  }
  const now = Date.now();
  const today = karachi({ year: 'numeric', month: '2-digit', day: '2-digit' });
  const gapDays = m.lastVisit ? Math.floor((now - m.lastVisit) / 86_400_000) : 0;
  const prevDay = m.lastDay;
  if (firstLoadThisSession) {
    m.visits += 1;
    m.lastVisit = now;
    m.lastDay = today;
    writeMemory(m);
  }
  return { m, firstLoadThisSession, gapDays, prevDay, today, now };
}

export function NoticeYou() {
  const path = usePathname();
  const mem = useRef<Memory | null>(null);
  const said = useRef(0);
  const lastAt = useRef(0);
  const usedThisVisit = useRef(new Set<string>());

  /** Say one line from a group, respecting the pace limits. `once` = never again on this phone. */
  const say = useCallback(
    (
      group: LineGroup,
      vars: Record<string, string | number> = {},
      opts: { once?: boolean; force?: boolean } = {},
    ) => {
      const m = mem.current;
      if (!m) return false;
      const now = Date.now();
      if (!opts.force && (now - lastAt.current < GAP_MS || said.current >= MAX_PER_VISIT))
        return false;
      if (opts.once && m.said.includes(group)) return false;
      if (usedThisVisit.current.has(group)) return false;
      const options = LINES[group];
      const text = fill(options[Math.floor(Math.random() * options.length)]!, vars);
      usedThisVisit.current.add(group);
      if (opts.once) {
        m.said.push(group);
        writeMemory(m);
      }
      said.current += 1;
      lastAt.current = now;
      petSay({ text, mood: MOOD_FOR[group] });
      return true;
    },
    [],
  );

  // Arrival: count the visit (once per page load, even if React runs effects twice) and greet.
  useEffect(() => {
    if (!arrival) arrival = arrive();
    const { m, firstLoadThisSession, gapDays, prevDay, today, now } = arrival;
    mem.current = m;

    const hour = Number(karachi({ hour: '2-digit', hour12: false }));
    const weekday = karachi({ weekday: 'long' });
    const time = karachi({ hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();
    const daysLeft = Math.ceil((EVENT_START - now) / 86_400_000);

    // Wait for the intro to lift before speaking.
    const id = window.setTimeout(() => {
      if (!firstLoadThisSession) return;
      const greet = (): boolean => {
        if (m.visits === 1) return say('firstVisit', {}, { once: true, force: true });
        if (gapDays >= 3) return say('longGap', { days: gapDays }, { force: true });
        if (prevDay === today && m.visits > 2) return say('sameDayAgain', {}, { force: true });
        if (m.visits === 2) return say('secondVisit', {}, { once: true, force: true });
        if (m.visits === 3) return say('thirdVisit', {}, { once: true, force: true });
        if (m.secret && Math.random() < 0.3) return say('secretBack', {}, { force: true });
        if (hour >= 0 && hour < 5)
          return say('lateNight', { time, hour: hour === 0 ? 12 : hour }, { force: true });
        if (hour >= 5 && hour < 8) return say('earlyMorning', {}, { force: true });
        if (weekday === 'Friday' && hour >= 12 && hour < 14)
          return say('jummah', {}, { force: true });
        if (hour >= 12 && hour < 15) return say('lunch', {}, { force: true });
        if (m.visits >= 5 && m.visits % 5 === 0)
          return say('manyVisits', { n: m.visits }, { force: true });
        if (hour >= 18 && hour < 22) return say('evening', {}, { force: true });
        return false;
      };
      if (!greet()) {
        if (daysLeft > 7) say('countdownFar', { days: daysLeft }, { force: true });
        else if (daysLeft > 1) say('countdownNear', { days: daysLeft }, { force: true });
        else if (daysLeft === 1) say('countdownTomorrow', {}, { force: true });
        else if (now < EVENT_START + 86_400_000) say('eventDay', {}, { force: true });
        else say('afterEvent', {}, { force: true });
      }
      // Dark mode, once ever.
      if (matchMedia('(prefers-color-scheme: dark)').matches) {
        window.setTimeout(() => say('darkMode', {}, { once: true }), GAP_MS + 2000);
      }
    }, 3200);
    return () => clearTimeout(id);
  }, [say]);

  // Page-specific lines.
  useEffect(() => {
    const m = mem.current;
    if (!m) return;
    const first = !m.pages.includes(path);
    if (first) {
      m.pages.push(path);
      writeMemory(m);
    }
    const id = window.setTimeout(() => {
      if (path === '/privacy') say('pagePrivacy', {}, { once: true });
      else if (path === '/ask') {
        if (m.askDraft)
          say('askDraft', {
            snippet: m.askDraft.slice(0, 40) + (m.askDraft.length > 40 ? '…' : ''),
          });
        else if (first) say('pageAskFirst');
      } else if (path === '/cv' && first) say('pageCvFirst');
      else if (path === '/games' && first) say('pageGamesFirst');
      else if (!['/', '/ask', '/cv', '/games', '/quiz', '/privacy'].includes(path))
        say('pageNotFound', {}, { once: true });
    }, 2500);
    return () => clearTimeout(id);
  }, [path, say]);

  // Behaviour watchers.
  useEffect(() => {
    startScrollSpeed();
    const cleanups: (() => void)[] = [];

    // Fast scroll, bottom of the page, back to the top.
    let fastSince = 0;
    let wasAtBottom = false;
    let raf = 0;
    const watch = (t: number) => {
      raf = requestAnimationFrame(watch);
      if (scroll.speed > 3200) {
        if (!fastSince) fastSince = t;
        else if (t - fastSince > 250) {
          say('fastScroll');
          fastSince = 0;
        }
      } else fastSince = 0;
      const atBottom = innerHeight + scrollY >= document.documentElement.scrollHeight - 40;
      if (atBottom && !wasAtBottom && scrollY > 1500) {
        wasAtBottom = true;
        say('bottomReached');
      }
      if (wasAtBottom && scrollY < 80) {
        wasAtBottom = false;
        say('backToTop');
      }
    };
    raf = requestAnimationFrame(watch);
    cleanups.push(() => cancelAnimationFrame(raf));

    // Idle for 25 s.
    let idleTimer = 0;
    const resetIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => say('idle'), 25_000);
    };
    resetIdle();
    for (const ev of ['pointerdown', 'keydown', 'scroll'] as const) {
      addEventListener(ev, resetIdle, { passive: true });
      cleanups.push(() => removeEventListener(ev, resetIdle));
    }
    cleanups.push(() => clearTimeout(idleTimer));

    // Leaving the tab and coming back.
    let hiddenAt = 0;
    const vis = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt) {
        const away = Date.now() - hiddenAt;
        hiddenAt = 0;
        if (away > 20_000)
          window.setTimeout(
            () =>
              say('returnedToTab', {
                secs: Math.round(away / 1000),
                mins: Math.max(1, Math.round(away / 60_000)),
              }),
            800,
          );
      }
    };
    document.addEventListener('visibilitychange', vis);
    cleanups.push(() => document.removeEventListener('visibilitychange', vis));

    // Staying a while.
    const stay = window.setTimeout(() => say('longStay', { mins: 4 }), 4 * 60_000);
    cleanups.push(() => clearTimeout(stay));

    // Battery (Android browsers).
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<{
        level: number;
        charging: boolean;
        addEventListener: (e: string, f: () => void) => void;
      }>;
    };
    nav
      .getBattery?.()
      .then((b) => {
        const check = () => {
          if (!b.charging && b.level <= 0.15) say('batteryLow', { pct: Math.round(b.level * 100) });
        };
        check();
        b.addEventListener('chargingchange', () => b.charging && say('charging'));
        b.addEventListener('levelchange', check);
      })
      .catch(() => {});

    // Online / offline.
    const off = () => say('offline', {}, { force: true });
    const on = () => say('online', {}, { force: true });
    addEventListener('offline', off);
    addEventListener('online', on);
    cleanups.push(() => {
      removeEventListener('offline', off);
      removeEventListener('online', on);
    });

    // Turning the phone sideways.
    const mq = matchMedia('(orientation: landscape) and (max-height: 500px)');
    const orient = () => mq.matches && say('landscape');
    mq.addEventListener('change', orient);
    cleanups.push(() => mq.removeEventListener('change', orient));

    // Copying text.
    const copy = () => say('copied');
    document.addEventListener('copy', copy);
    cleanups.push(() => document.removeEventListener('copy', copy));

    // Rage taps: 5 taps in 1.2 s around the same spot.
    let taps: { x: number; y: number; t: number }[] = [];
    const tap = (e: PointerEvent) => {
      const t = performance.now();
      taps = taps.filter(
        (p) => t - p.t < 1200 && Math.hypot(p.x - e.clientX, p.y - e.clientY) < 50,
      );
      taps.push({ x: e.clientX, y: e.clientY, t });
      if (taps.length >= 5) {
        taps = [];
        say('rageTap', {}, { force: true });
      }
    };
    addEventListener('pointerdown', tap, { passive: true });
    cleanups.push(() => removeEventListener('pointerdown', tap));

    // Unfinished questions: remember the draft on this phone only.
    const input = (e: Event) => {
      const el = e.target as HTMLElement | null;
      if (!(el instanceof HTMLTextAreaElement) || location.pathname !== '/ask' || !mem.current)
        return;
      mem.current.askDraft = el.value.trim() || null;
      writeMemory(mem.current);
    };
    document.addEventListener('input', input);
    cleanups.push(() => document.removeEventListener('input', input));

    // Signals from the rest of the site.
    let menuOpens = 0;
    const signal = (e: Event) => {
      const kind = (e as CustomEvent<string>).detail;
      const m = mem.current;
      if (kind === 'menu' && ++menuOpens === 3) say('menuLover');
      if (kind === 'secret' && m) {
        m.secret = true;
        writeMemory(m);
      }
      if (kind === 'done:ask' && m) {
        m.askDraft = null;
        writeMemory(m);
        window.setTimeout(() => say('doneAsk', {}, { force: true }), 2600);
      }
      if (kind === 'done:cv') window.setTimeout(() => say('doneCv', {}, { force: true }), 2600);
      if (kind === 'done:games')
        window.setTimeout(() => say('doneGames', {}, { force: true }), 2600);
    };
    addEventListener('cc:notice', signal);
    cleanups.push(() => removeEventListener('cc:notice', signal));

    return () => cleanups.forEach((c) => c());
  }, [say]);

  return null;
}

/** Picks a random line from a group and fills its blanks (used by the pet for its own moments). */
export function lineFrom(group: LineGroup, vars: Record<string, string | number> = {}) {
  const options = LINES[group];
  return fill(options[Math.floor(Math.random() * options.length)]!, vars);
}

/** Lets other parts of the site tell the narrator something happened. */
export function notify(kind: string) {
  dispatchEvent(new CustomEvent('cc:notice', { detail: kind }));
}
