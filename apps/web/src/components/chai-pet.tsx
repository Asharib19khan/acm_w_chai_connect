'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { Mood, PetLine } from '@/lib/pet-bus';
import { petFeet, world } from '@/lib/pet-world';
import { scroll, startScrollSpeed } from '@/lib/scroll-speed';
import { playSound } from '@/lib/sound';
import { lineFrom } from './notice-you';

/*
 * Chai: a little cutting-chai glass that lives on the page and has a mind of its own.
 *
 * RIG    The cup is drawn once; legs and arms are two-bone limbs solved with inverse kinematics
 *        every frame, in screen space, in one full-screen SVG. Feet are PLANTED: a foot stays put
 *        until the body has moved past it, then lifts and arcs to a new spot ahead (no sliding).
 *        Hands grip real points when climbing, hanging and mantling.
 * BODY   The feet point (s.x, s.y) moves with acceleration, not instantly. The pelvis rides a
 *        spring above the feet: it bobs with each step, dips to absorb landings, lags when the page
 *        scrolls under it. Gravity, bounces, tumbling throws, sloshing chai, spills.
 * WORLD  The floor is the bottom of the screen; tops of big headings, the dot title and any
 *        [data-pet-ledge] element are ledges; the screen's sides are walls it can climb; the
 *        spinning sticker ([data-pet-kettle]) is its kettle.
 * MOVES  Walk / run with planted feet, crouch-and-jump, lower itself off a ledge edge (grab, hang,
 *        swing, drop), hand-over-hand wall climbing, mantling up onto a ledge, teetering at edges,
 *        perching on an edge with legs dangling, balancing when you scroll.
 * BRAIN  Needs (energy, chai, boredom, loneliness, curiosity) + mood + hour + memory pick what to
 *        do next. It talks with a moving mouth, gestures and faces you while it speaks.
 */

const K = 0.9; // cup drawing units -> px
const HIP_H = 13.2; // standing pelvis height above the feet
const THIGH = 7.6;
const SHIN = 7.6;
const UPPER = 5.6;
const FORE = 5.6;
const GRAVITY = 2400;
const MEMORY_KEY = 'cc_pet_v1';
const LEDGE_SELECTOR =
  'main h1:not([data-pet-skip] *), main h2:not([data-pet-skip] *), [data-pet-ledge]';

type Mode = 'ground' | 'air' | 'drag' | 'wall' | 'mantle' | 'hang' | 'grapple';
type Activity =
  | 'idle'
  | 'sleep'
  | 'refill'
  | 'explore'
  | 'read'
  | 'play'
  | 'stretch'
  | 'jacks'
  | 'dance'
  | 'approach'
  | 'waveOthers'
  | 'sit'
  | 'perch'
  | 'tap'
  | 'scratch'
  | 'yawn'
  | 'look'
  | 'flee'
  | 'muse'
  | 'joke'
  | 'signal'
  | 'rang';

interface Ledge {
  el: Element | null; // null = the floor
  left: number;
  right: number;
  top: number;
  key: string;
}

interface Memory {
  trust: number;
  pets: number;
  throws: number;
  favourites: Record<string, number>;
  bornAt: number;
}

interface Foot {
  x: number;
  y: number;
  planted: boolean;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  t: number;
  dur: number;
}

const MOUTHS: Record<Mood, string> = {
  happy: 'M25.5 50 Q30 54.5 34.5 50',
  excited: 'M25 49 Q30 57 35 49 Z',
  curious: 'M28.4 51.5 a1.6 1.6 0 1 0 3.2 0 a1.6 1.6 0 1 0 -3.2 0',
  sleepy: 'M28 52 Q30 50.5 32 52',
  annoyed: 'M26 52 L34 51',
  love: 'M25.5 49.5 Q30 55 34.5 49.5',
  dizzy: 'M25 51 q1.25 -2 2.5 0 t2.5 0 t2.5 0 t2.5 0',
  sad: 'M26 53 Q30 49 34 53',
  shy: 'M27.5 51.5 Q30 53 32.5 51.5',
  proud: 'M26 50.5 Q31 53.5 35 49.5',
  scared: 'M28 50 a2 2.6 0 1 0 4 0 a2 2.6 0 1 0 -4 0',
  silly: 'M25.5 49.5 Q30 55 34.5 49.5',
};
const MOUTH_OPEN = 'M26.5 49 Q30 56.5 33.5 49 Z';
const SPEED: Record<Mood, number> = {
  happy: 72,
  excited: 120,
  curious: 66,
  sleepy: 34,
  annoyed: 95,
  love: 62,
  dizzy: 26,
  sad: 40,
  shy: 50,
  proud: 80,
  scared: 140,
  silly: 90,
};

function loadMemory(): Memory {
  const fresh: Memory = { trust: 0.6, pets: 0, throws: 0, favourites: {}, bornAt: Date.now() };
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    if (raw) return { ...fresh, ...(JSON.parse(raw) as Partial<Memory>) };
  } catch {
    // storage blocked
  }
  return fresh;
}
function saveMemory(m: Memory) {
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(m));
  } catch {
    // ignore
  }
}
const karachiHour = () =>
  Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Karachi',
      hour: '2-digit',
      hour12: false,
    }).format(Date.now()),
  );
const ledgeKey = (el: Element | null) =>
  el ? `${el.tagName}:${(el.textContent ?? '').trim().slice(0, 24)}` : 'floor';
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Two-bone IK: the joint (knee/elbow) and the reachable end point. */
function ik(ax: number, ay: number, tx: number, ty: number, l1: number, l2: number, bend: number) {
  let dx = tx - ax;
  let dy = ty - ay;
  let d = Math.hypot(dx, dy) || 0.001;
  const max = l1 + l2 - 0.01;
  if (d > max) {
    dx = (dx / d) * max;
    dy = (dy / d) * max;
    d = max;
  }
  d = Math.max(d, Math.abs(l1 - l2) + 0.01);
  const a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const base = Math.atan2(dy, dx);
  const ang = base - bend * a;
  return { jx: ax + Math.cos(ang) * l1, jy: ay + Math.sin(ang) * l1, ex: ax + dx, ey: ay + dy };
}

export function ChaiPet() {
  const path = usePathname();
  const hidden = path.startsWith('/quiz');
  // On the Games page the pet suits up as Chaiman (cape, cowl, gadgets).
  const hero = path.startsWith('/games');
  const heroRef = useRef(hero);
  useEffect(() => {
    heroRef.current = hero;
  }, [hero]);
  const svgRef = useRef<SVGSVGElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const tailRef = useRef<HTMLSpanElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const [mood, setMood] = useState<Mood>('happy');
  const [line, setLine] = useState<{ id: number; text: string } | null>(null);
  const moodRef = useRef<Mood>('happy');
  const api = useRef<{ say: (l: PetLine) => void } | null>(null);

  useEffect(() => {
    moodRef.current = mood;
  }, [mood]);

  useEffect(() => {
    const onSay = (e: Event) => api.current?.say((e as CustomEvent<PetLine>).detail);
    addEventListener('cc:pet-say', onSay);
    return () => removeEventListener('cc:pet-say', onSay);
  }, []);

  useEffect(() => {
    if (hidden) return;
    const svg = svgRef.current!;
    const q = <T extends Element>(name: string) => svg.querySelector(`[data-part=${name}]`) as T;
    const body = q<SVGGElement>('body');
    const hit = q<SVGGElement>('hit');
    const chai = q<SVGPathElement>('chai');
    const foam = q<SVGPathElement>('foam');
    const steamG = q<SVGGElement>('steam');
    const mouth = q<SVGPathElement>('mouth');
    const legPaths = [q<SVGPathElement>('legL'), q<SVGPathElement>('legR')];
    const footEls = [q<SVGEllipseElement>('footL'), q<SVGEllipseElement>('footR')];
    const armPaths = [q<SVGPathElement>('armL'), q<SVGPathElement>('armR')];
    const handEls = [q<SVGCircleElement>('handL'), q<SVGCircleElement>('handR')];
    const shadow = shadowRef.current!;
    const cape = q<SVGPathElement>('cape');
    const rope = q<SVGLineElement>('rope');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    startScrollSpeed();
    const mem = loadMemory();

    const vw = () => innerWidth;
    const vh = () => innerHeight;
    const floorY = () => vh() - 6;

    // ---------------- state ----------------
    const s = {
      x: vw() - 80, // feet point (between the feet, on the surface)
      y: -160,
      vx: 0,
      vy: 0,
      walkV: 0,
      mode: 'air' as Mode,
      ledge: null as Element | null,
      offset: 0,
      facing: -1 as 1 | -1,
      pelvisY: -160 - HIP_H,
      pelvisV: 0,
      absorb: 0,
      squash: 0,
      ang: 0,
      angV: 0,
      slosh: 0,
      sloshV: 0,
      prevX: 0,
      worldVx: 0,
      bounced: false,
      softDrop: false,
      crouchUntil: 0,
      pendingJump: null as { key: string; x: number } | null,
      teeterUntil: 0,
      blinkAt: performance.now() + 2000,
      lastInput: performance.now(),
      lastSay: 0,
      talkUntil: 0,
      moodUntil: 0,
      pets: [] as number[],
      energy: 0.8,
      chai: 0.85,
      boredom: 0.2,
      lonely: 0.2,
      curiosity: 0.6,
      activity: 'idle' as Activity,
      until: 0,
      goal: null as { key: string; x: number } | null,
      visited: new Map<string, number>(),
      nextDecision: performance.now() + 2500,
      planStarted: 0,
      planHops: 0,
      bestDist: 1e9,
      bestAt: 0,
      wall: { side: 1 as 1 | -1, key: '', cycle: 0, grip: [0, 0], footGrip: [0, 0] },
      hang: { edgeX: 0, out: 1 as 1 | -1, t: 0, el: null as Element | null },
      mantle: {
        t: 0,
        fromX: 0,
        fromY: 0,
        toX: 0,
        toY: 0,
        edgeX: 0,
        top: 0,
        el: null as Element | null,
      },
      perch: { edgeX: 0, out: 1 as 1 | -1 },
      drop: { el: null as Element | null, until: 0 },
      avoid: new Map<string, number>(),
      progress: { x: 0, y: 0, at: 0 },
      ledgeTop: 0,
      ledgeV: 0,
      grapple: { ax: 0, ay: 0, key: '', t: 0 },
      gliding: false,
      wasHero: false,
    };
    const feet: Foot[] = [0, 1].map(() => ({
      x: s.x,
      y: s.y,
      planted: false,
      fromX: 0,
      fromY: 0,
      toX: 0,
      toY: 0,
      t: 1,
      dur: 0.2,
    }));
    const hands = [0, 1].map(() => ({ x: s.x, y: s.y - 20 }));
    const pointer = { x: vw() / 2, y: vh() / 2 };
    let drag: {
      dx: number;
      dy: number;
      lastX: number;
      lastY: number;
      lastT: number;
      vx: number;
      vy: number;
      moved: boolean;
    } | null = null;
    let downPos = { x: 0, y: 0 };

    // ---------------- voice & mood ----------------
    const setMoodFor = (m: Mood, ms = 8000) => {
      setMood(m);
      s.moodUntil = performance.now() + ms;
    };
    const own = (
      group: Parameters<typeof lineFrom>[0],
      m?: Mood,
      vars: Record<string, string | number> = {},
      gap = 6000,
    ) => {
      if (performance.now() - s.lastSay < gap) {
        if (m) setMoodFor(m);
        return false;
      }
      say({ text: lineFrom(group, vars), mood: m });
      return true;
    };
    const wake = () => {
      if (s.activity !== 'sleep') return;
      s.activity = 'idle';
      s.until = 0;
      s.nextDecision = performance.now() + 1500;
      s.energy = Math.max(s.energy, 0.4);
      own('wokeUp', 'sleepy', {}, 0);
    };
    const say = (l: PetLine) => {
      const now = performance.now();
      setLine({ id: now, text: l.text });
      s.lastSay = now;
      s.talkUntil = now + l.text.length * 20 + 250;
      playSound('tick');
      if (l.mood) setMoodFor(l.mood);
      if (s.activity === 'sleep' && l.mood !== 'sleepy') wake();
    };
    api.current = { say };

    // ---------------- world ----------------
    const toLedge = (e: Element | null): Ledge | null => {
      if (!e) return { el: null, left: 0, right: vw(), top: floorY(), key: 'floor' };
      if (!e.isConnected) return null;
      const r = e.getBoundingClientRect();
      if (r.width < 70 || r.top < 70 || r.top > vh() - 20) return null;
      return {
        el: e,
        left: Math.max(4, r.left),
        right: Math.min(vw() - 4, r.right),
        top: r.top,
        key: ledgeKey(e),
      };
    };
    const ledges = (): Ledge[] => {
      const out: Ledge[] = [toLedge(null)!];
      document.querySelectorAll(LEDGE_SELECTOR).forEach((e) => {
        const l = toLedge(e);
        if (l) out.push(l);
      });
      return out;
    };
    const kettle = () => {
      const e = document.querySelector('[data-pet-kettle]');
      return e ? toLedge(e) : null;
    };
    const current = () => toLedge(s.ledge);

    // Chai droplets flying out of the glass.
    let cupTop = { x: s.x, y: s.y - 50 };
    const spill = (n: number, dir = 0) => {
      s.chai = Math.max(0, s.chai - n * 0.012);
      for (let i = 0; i < n; i++) {
        const d = document.createElement('span');
        d.className = 'cc-pet-drop';
        d.style.left = `${cupTop.x}px`;
        d.style.top = `${cupTop.y}px`;
        document.body.appendChild(d);
        const vx = (dir || (Math.random() - 0.5) * 2) * (60 + Math.random() * 160);
        const vy = -(180 + Math.random() * 260);
        const frames: Keyframe[] = [];
        for (let k = 0; k <= 8; k++) {
          const t = (k / 8) * 0.7;
          frames.push({
            transform: `translate(${(vx * t).toFixed(1)}px, ${(vy * t + 0.5 * 1800 * t * t).toFixed(1)}px) scale(${(1 - k / 12).toFixed(2)})`,
            opacity: k < 6 ? 1 : 1 - (k - 5) / 3,
          });
        }
        d.animate(frames, { duration: 700, easing: 'linear' }).onfinish = () => d.remove();
      }
    };

    // ---------------- movement primitives ----------------
    const plantFeet = (y: number) => {
      feet.forEach((f, i) => {
        f.x = s.x + (i === 0 ? -4 : 4);
        f.y = y;
        f.planted = true;
        f.t = 1;
      });
    };
    const land = (l: Ledge, impact: number) => {
      s.ledgeTop = 0;
      s.ledgeV = 0;
      s.progress = { x: s.x, y: s.y, at: performance.now() };
      const soft = s.softDrop;
      s.softDrop = false;
      s.sloshV += (Math.random() < 0.5 ? -1 : 1) * Math.min(6, impact / 300);
      if (!soft && impact > 1100) spill(Math.min(7, Math.round(impact / 450)));
      if (!soft && impact > 950 && !s.bounced) {
        s.bounced = true;
        s.y = l.top - 1;
        s.vy = -impact * 0.3;
        s.vx *= 0.6;
        s.squash = Math.min(0.4, impact / 3500);
        playSound('pop');
        return;
      }
      s.bounced = false;
      s.angV += (Math.random() - 0.5) * Math.min(300, impact / 5);
      s.mode = 'ground';
      s.ledge = l.el;
      s.offset = s.x - l.left;
      s.y = l.top;
      s.walkV = s.vx * 0.3;
      s.vx = 0;
      s.vy = 0;
      s.absorb = Math.min(8, impact / 160); // knees soak it up
      s.squash = Math.min(0.3, impact / 4500);
      plantFeet(l.top);
      s.visited.set(l.key, performance.now());
      mem.favourites[l.key] = (mem.favourites[l.key] ?? 0) + 1;
      if (!soft && impact > 1500) {
        setMoodFor('dizzy', 3500);
        own('thrown', 'dizzy', {}, 0);
        playSound('boom');
        s.activity = 'sit';
        s.goal = null;
        s.until = performance.now() + 2500;
      } else if (impact > 450) playSound('pop');
      // Landed close to an edge: teeter.
      if (l.el && (s.x - l.left < 9 || l.right - s.x < 9)) {
        s.teeterUntil = performance.now() + 900;
        s.facing = s.x - l.left < 9 ? -1 : 1;
        own('teeter', 'curious', {}, 8000);
      }
    };
    const jumpTo = (l: Ledge, x: number) => {
      if (s.mode === 'ground' && !s.pendingJump) {
        s.pendingJump = { key: l.key, x };
        s.crouchUntil = performance.now() + 170;
        s.facing = x > s.x ? 1 : -1;
        return;
      }
      s.pendingJump = null;
      s.squash = -0.2;
      s.planHops += 1;
      const rise = s.y - l.top + 36;
      const vy = -Math.sqrt(2 * GRAVITY * Math.max(30, rise));
      const t = (-vy + Math.sqrt(Math.max(0, vy * vy - 2 * GRAVITY * (s.y - l.top)))) / GRAVITY;
      s.vx = (x - s.x) / Math.max(0.25, t);
      s.vy = vy;
      s.mode = 'air';
      s.ledge = null;
      s.facing = x > s.x ? 1 : -1;
      s.energy = Math.max(0, s.energy - 0.02);
      feet.forEach((f) => (f.planted = false));
      playSound('whoosh');
    };
    const reachable = (from: { x: number; y: number }, l: Ledge) =>
      l.top < from.y + 12 &&
      l.top > from.y - 390 &&
      from.x > l.left - 360 &&
      from.x < l.right + 360;

    /** Walk with easing toward x on the current ledge. Returns true once stopped there. */
    const walkToward = (here: Ledge, x: number, maxSpeed: number, dt: number) => {
      x = clamp(
        x,
        here.el ? Math.max(24, here.left + 3) : 24,
        here.el ? Math.min(vw() - 24, here.right - 3) : vw() - 24,
      );
      const dist = x - s.x;
      const desired = Math.sign(dist) * Math.min(maxSpeed, Math.abs(dist) * 4);
      const accel = 420;
      s.walkV += clamp(desired - s.walkV, -accel * dt, accel * dt);
      s.offset += s.walkV * dt;
      s.x = here.left + s.offset;
      if (Math.abs(s.walkV) > 6) s.facing = s.walkV > 0 ? 1 : -1;
      return Math.abs(dist) < 3 && Math.abs(s.walkV) < 14;
    };

    /** Begin lowering itself off the edge of the current ledge. */
    const startHang = (here: Ledge, out: 1 | -1) => {
      s.planHops += 1;
      const edge = out > 0 ? here.right : here.left;
      if (edge < 40 || edge > vw() - 40 || here.top + 55 > floorY()) {
        // The ledge reaches the screen's side: hop down inward instead of hanging off-screen.
        // Can't hang here: hop and drop past this ledge (it won't catch us for a moment).
        s.mode = 'air';
        s.ledge = null;
        s.drop = { el: here.el, until: performance.now() + 700 };
        s.vx = -out * 50;
        s.vy = -220;
        s.softDrop = true;
        feet.forEach((f) => (f.planted = false));
        return;
      }
      s.mode = 'hang';
      s.hang = { edgeX: out > 0 ? here.right : here.left, out, t: 0, el: here.el };
      s.facing = -out as 1 | -1; // turns back toward the ledge to grip it
      s.walkV = 0;
      feet.forEach((f) => (f.planted = false));
    };

    const startGrapple = (target: Ledge, gx: number) => {
      s.mode = 'grapple';
      s.ledge = null;
      s.pendingJump = null;
      s.grapple = {
        ax: clamp(gx, target.left + 16, target.right - 16),
        ay: target.top,
        key: target.key,
        t: 0,
      };
      s.facing = s.grapple.ax > s.x ? 1 : -1;
      feet.forEach((f) => (f.planted = false));
      playSound('whoosh');
      if (Math.random() < 0.5) own('grapple', 'excited', {}, 10_000);
    };
    let handPos = { x: 0, y: 0 };
    const throwRang = () => {
      const r = document.createElement('span');
      r.className = 'cc-rang';
      r.innerHTML =
        '<svg viewBox="0 0 40 24" width="26" height="16"><path d="M2 12 L10 2 L14 9 L20 4 L26 9 L30 2 L38 12 L30 22 L20 16 L10 22 Z" fill="#111" stroke="#ff4fd8" stroke-width="2.5" stroke-linejoin="round"/></svg>';
      r.style.left = `${handPos.x - 13}px`;
      r.style.top = `${handPos.y - 8}px`;
      document.body.appendChild(r);
      const dir = s.facing;
      const reach = Math.min(170, Math.max(80, dir > 0 ? vw() - handPos.x - 40 : handPos.x - 40));
      const frames: Keyframe[] = [];
      for (let k = 0; k <= 16; k++) {
        const t = k / 16;
        const a = t * Math.PI * 2;
        frames.push({
          transform: `translate(${(dir * Math.sin(a / 2) * reach).toFixed(1)}px, ${(-Math.sin(a) * 30).toFixed(1)}px) rotate(${(t * 1440).toFixed(0)}deg)`,
        });
      }
      r.animate(frames, { duration: 1200, easing: 'linear' }).onfinish = () => {
        r.remove();
        playSound('pop');
      };
      playSound('whoosh');
    };

    /**
     * One step toward the goal ledge. Returns true when standing on it at the goal x.
     * Same ledge: walk. Above and in reach: crouch + jump. Above but far: stepping stone, or get
     * to the floor and climb the screen wall. Below: walk to the edge and lower itself off.
     */
    const steer = (dt: number, speed: number): boolean => {
      const g = s.goal;
      if (!g) return true;
      const here = current();
      if (!here) return false;
      const target =
        g.key === 'floor' ? toLedge(null) : (ledges().find((l) => l.key === g.key) ?? null);
      // Loop breakers: no real progress toward the target in 6 s, or too many hops on one trip.
      if (target) {
        const d = Math.hypot(clamp(g.x, target.left, target.right) - s.x, target.top - s.y);
        const now2 = performance.now();
        if (d < s.bestDist - 30) {
          s.bestDist = d;
          s.bestAt = now2;
        } else if (now2 - s.bestAt > 6000 || s.planHops > 5) {
          s.avoid.set(g.key, now2 + 30_000);
          s.goal = null;
          s.until = 0;
          s.walkV = 0;
          own('stuck', 'curious', {}, 20_000);
          return true;
        }
      }
      if (!target || performance.now() - s.planStarted > 18_000) {
        s.goal = null;
        return true;
      }
      if (target.key === here.key) {
        return walkToward(here, clamp(g.x, target.left + 14, target.right - 14), speed, dt);
      }
      if (
        Math.abs(target.top - s.y) < 14 &&
        target.left < here.right + 10 &&
        target.right > here.left - 10
      ) {
        s.goal = null; // effectively the same surface
        return true;
      }
      if (heroRef.current && target.top < s.y - 30) {
        startGrapple(target, g.x);
        return false;
      }
      if (target.top < s.y + 12) {
        if (reachable({ x: s.x, y: s.y }, target)) {
          const takeOff = clamp(
            g.x,
            here.el ? here.left + 12 : 20,
            here.el ? here.right - 12 : vw() - 20,
          );
          if (Math.abs(takeOff - s.x) > 180) {
            walkToward(here, takeOff, speed, dt);
            return false;
          }
          jumpTo(target, clamp(g.x, target.left + 20, target.right - 20));
          return false;
        }
        const stone = ledges()
          .filter(
            (l) =>
              l.key !== here.key &&
              reachable({ x: s.x, y: s.y }, l) &&
              l.top >= target.top - 5 &&
              l.top < s.y - 90,
          )
          .sort((a, b) => a.top - b.top)[0];
        if (stone) {
          jumpTo(stone, clamp(target.left + 30, stone.left + 20, stone.right - 20));
          return false;
        }
        if (here.el) {
          const out: 1 | -1 = s.x < (here.left + here.right) / 2 ? -1 : 1;
          if (walkToward(here, out < 0 ? here.left + 6 : here.right - 6, speed, dt))
            startHang(here, out);
          return false;
        }
        // On the floor, nothing in reach: walk to the nearer side and climb the screen wall.
        const side: 1 | -1 = (target.left + target.right) / 2 < vw() / 2 ? -1 : 1;
        const wallX = side < 0 ? 13 : vw() - 13;
        if (walkToward(here, wallX, speed, dt)) {
          s.mode = 'wall';
          s.wall = {
            side,
            key: target.key,
            cycle: 0,
            grip: [s.y - 34, s.y - 26],
            footGrip: [s.y - 4, s.y],
          };
          s.facing = side;
          feet.forEach((f) => (f.planted = false));
          if (Math.random() < 0.5) own('climbing', 'curious', {}, 12_000);
        }
        return false;
      }
      // Target is below: go to the nearer edge and lower itself off.
      if (here.el) {
        const nearLeft =
          Math.abs(target.left + 20 - here.left) < Math.abs(target.left + 20 - here.right);
        const out: 1 | -1 = nearLeft ? -1 : 1;
        if (walkToward(here, out < 0 ? here.left + 6 : here.right - 6, speed, dt))
          startHang(here, out);
        return false;
      }
      s.goal = null;
      return true;
    };

    // ---------------- the brain ----------------
    const decide = (now: number) => {
      const h = karachiHour();
      const night = h >= 23 || h < 5;
      const morning = h >= 6 && h < 10;
      const chaiTime = h >= 16 && h < 18;
      const m = moodRef.current;
      const hasKettle = Boolean(kettle());
      const sinceInput = (now - s.lastInput) / 1000;
      const here = current();
      const onLedge = Boolean(here?.el);
      const hasTitle = Boolean(document.querySelector('main h1[data-pet-play]'));
      const options: [Activity, number][] = [
        [
          'sleep',
          Math.max(0, 0.55 - s.energy) * 2.6 + (night ? 0.6 : 0) + (sinceInput > 60 ? 0.4 : 0),
        ],
        ['refill', (1 - s.chai) * 1.7 + (chaiTime ? 0.35 : 0) - (hasKettle ? 0 : 0.5)],
        ['explore', s.curiosity * 0.9 + s.boredom * 0.4 + (m === 'curious' ? 0.2 : 0)],
        ['read', 0.22 + s.curiosity * 0.3 + (onLedge ? 0.15 : -0.3)],
        ['play', s.boredom * 0.9 + (hasTitle ? 0.15 : -0.6) + (m === 'excited' ? 0.2 : 0)],
        ['stretch', (morning ? 0.55 : 0.1) + (s.energy > 0.5 ? 0.08 : 0)],
        ['jacks', s.energy > 0.6 ? s.boredom * 0.5 + 0.05 : 0],
        ['dance', m === 'happy' || m === 'love' || m === 'excited' ? 0.24 + s.boredom * 0.3 : 0.02],
        ['approach', s.lonely * (0.6 + mem.trust) + (sinceInput < 6 ? 0.2 : -0.2)],
        ['waveOthers', world.othersReading > 0 ? 0.32 + s.lonely * 0.2 : 0],
        ['sit', 0.14 + (m === 'sad' || m === 'sleepy' ? 0.3 : 0)],
        ['perch', onLedge ? 0.3 + (m === 'happy' ? 0.1 : 0) : 0],
        ['tap', 0.16 + s.boredom * 0.2],
        ['scratch', 0.12 + s.curiosity * 0.1],
        ['yawn', m === 'sleepy' || s.energy < 0.45 ? 0.35 : 0.04],
        ['look', 0.2],
        ['muse', 0.16 + s.curiosity * 0.1],
        ['joke', m === 'happy' || m === 'silly' ? 0.12 : 0.03],
        ['signal', heroRef.current ? 0.2 : 0],
        ['rang', heroRef.current ? 0.28 + s.boredom * 0.3 : 0],
        ['explore', heroRef.current ? 0.15 : 0],
      ];
      const best = options
        .map(([a, v]) => [a, v + Math.random() * 0.25] as [Activity, number])
        .sort((a, b) => b[1] - a[1])[0]!;
      start(best[0], now);
    };

    const start = (a: Activity, now: number) => {
      s.activity = a;
      s.goal = null;
      s.planStarted = now;
      s.planHops = 0;
      s.bestDist = 1e9;
      s.bestAt = now;
      const ls = ledges();
      const here = current();
      switch (a) {
        case 'sleep': {
          const fav = ls
            .filter((l) => (mem.favourites[l.key] ?? 0) > 2)
            .sort((x, y) => (mem.favourites[y.key] ?? 0) - (mem.favourites[x.key] ?? 0))[0];
          if (fav && fav.key !== here?.key) {
            s.goal = { key: fav.key, x: (fav.left + fav.right) / 2 };
            own('sleepSpot', 'sleepy', {}, 15_000);
          }
          s.until = now + 14_000 + Math.random() * 10_000;
          break;
        }
        case 'refill': {
          const k = kettle();
          if (!k) {
            if (s.chai < 0.25) own('outOfChai', 'sad', {}, 20_000);
            s.activity = 'sit';
            s.until = now + 5000;
            break;
          }
          s.goal = { key: k.key, x: (k.left + k.right) / 2 };
          s.until = now + 20_000;
          own('refillGo', 'curious', {}, 12_000);
          break;
        }
        case 'explore': {
          const pick = ls
            .filter((l) => l.key !== here?.key && (s.avoid.get(l.key) ?? 0) < now)
            .sort((x, y) => (s.visited.get(x.key) ?? 0) - (s.visited.get(y.key) ?? 0))[0];
          if (pick)
            s.goal = {
              key: pick.key,
              x: pick.left + 20 + Math.random() * Math.max(10, pick.right - pick.left - 40),
            };
          s.until = now + 16_000;
          if (s.boredom > 0.7) own('bored', 'curious', {}, 20_000);
          break;
        }
        case 'read': {
          s.until = now + 4200;
          const text = (s.ledge?.textContent ?? '').replace(/\s+/g, ' ').trim();
          if (text && Math.random() < 0.5)
            own('reading', 'curious', { text: text.slice(0, 28) }, 15_000);
          break;
        }
        case 'play': {
          const title = document.querySelector('main h1');
          const l = title ? toLedge(title) : null;
          if (l) s.goal = { key: l.key, x: l.left + 30 };
          s.until = now + 9000;
          break;
        }
        case 'approach': {
          const under = ls
            .filter((l) => pointer.x > l.left && pointer.x < l.right && l.top >= pointer.y - 10)
            .sort((x, y) => x.top - y.top)[0];
          const t = under ?? toLedge(null)!;
          s.goal = { key: t.key, x: pointer.x };
          s.until = now + 10_000;
          if (s.lonely > 0.6) own('comeHere', 'happy', {}, 20_000);
          break;
        }
        case 'signal':
          s.until = now + 4500;
          dispatchEvent(new CustomEvent('cc:signal'));
          own('signal', 'curious', {}, 10_000);
          playSound('shimmer');
          break;
        case 'rang':
          s.until = now + 1700;
          setTimeout(throwRang, 250);
          own('rang', 'excited', {}, 12_000);
          break;
        case 'perch': {
          if (!here?.el) {
            s.activity = 'sit';
            s.until = now + 3000;
            break;
          }
          const out: 1 | -1 = s.x - here.left < here.right - s.x ? -1 : 1;
          s.perch = { edgeX: out < 0 ? here.left : here.right, out };
          s.goal = { key: here.key, x: out < 0 ? here.left + 7 : here.right - 7 };
          s.until = now + 6000 + Math.random() * 5000;
          if (Math.random() < 0.4) own('perch', 'happy', {}, 20_000);
          break;
        }
        case 'waveOthers':
          s.until = now + 3000;
          s.facing = 1;
          own('othersHere', 'happy', {}, 30_000);
          break;
        case 'stretch': {
          s.until = now + 2600;
          const h = karachiHour();
          if (h >= 6 && h < 10) own('morningStretch', 'sleepy', {}, 60_000);
          break;
        }
        case 'scratch':
          s.until = now + 2200;
          if (Math.random() < 0.3) own('scratch', 'curious', {}, 25_000);
          break;
        case 'yawn':
          s.until = now + 2000;
          setMoodFor('sleepy', 2500);
          break;
        case 'jacks':
          s.until = now + 3500;
          break;
        case 'dance':
          s.until = now + 4500;
          own('dance', 'happy', {}, 25_000);
          playSound('shimmer');
          break;
        case 'tap':
        case 'muse':
          s.until = now + 3500;
          own('musing', 'curious', {}, 15_000);
          break;
        case 'joke':
          s.until = now + 4000;
          own('joke', 'silly', {}, 20_000);
          break;
        case 'look':
          s.until = now + 2200 + Math.random() * 1500;
          break;
        case 'sit':
          s.until = now + 3000 + Math.random() * 3000;
          break;
        default:
          s.until = now + 2000;
      }
    };

    // ---------------- input ----------------
    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      s.lastInput = performance.now();
      if (!drag && Math.hypot(e.clientX - s.x, e.clientY - (s.y - 34)) < 60 && Math.random() < 0.02)
        own('shyFirst', 'shy', {}, 30_000);
      if (drag) {
        const t = performance.now();
        const dt = Math.max(1, t - drag.lastT) / 1000;
        drag.vx = drag.vx * 0.5 + ((e.clientX - drag.lastX) / dt) * 0.5;
        drag.vy = drag.vy * 0.5 + ((e.clientY - drag.lastY) / dt) * 0.5;
        drag.lastX = e.clientX;
        drag.lastY = e.clientY;
        drag.lastT = t;
        if (!drag.moved && Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 8) {
          drag.moved = true;
          s.mode = 'drag';
          s.ledge = null;
          s.pendingJump = null;
          feet.forEach((f) => (f.planted = false));
          own('pickedUp', 'excited', {}, 3000);
        }
      }
    };
    const onPageDown = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      s.lastInput = performance.now();
      const d = Math.hypot(e.clientX - s.x, e.clientY - (s.y - 34));
      if (mem.trust < 0.35 && d < 110 && d > 30 && s.mode === 'ground' && s.activity !== 'flee') {
        s.activity = 'flee';
        s.goal = null;
        s.until = performance.now() + 1800;
        s.facing = e.clientX > s.x ? -1 : 1;
        own('dodge', 'annoyed', {}, 4000);
      }
    };
    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      hit.setPointerCapture(e.pointerId);
      downPos = { x: e.clientX, y: e.clientY };
      drag = {
        dx: s.x - e.clientX,
        dy: s.y - e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        lastT: performance.now(),
        vx: 0,
        vy: 0,
        moved: false,
      };
      wake();
    };
    const heart = () => {
      const h = document.createElement('span');
      h.textContent = '♥';
      h.className = 'cc-pet-heart';
      h.style.left = `${s.x + (Math.random() - 0.5) * 20}px`;
      h.style.top = `${s.y - 70}px`;
      document.body.appendChild(h);
      setTimeout(() => h.remove(), 1100);
    };
    const onUp = () => {
      if (!drag) return;
      const now = performance.now();
      if (!drag.moved) {
        s.pets = s.pets.filter((t) => now - t < 3000);
        s.pets.push(now);
        s.squash = 0.18;
        s.lonely = Math.max(0, s.lonely - 0.25);
        mem.pets += 1;
        const before = mem.trust;
        mem.trust = Math.min(1, mem.trust + 0.03);
        if (before < 0.5 && mem.trust >= 0.5) own('trustUp', 'love', {}, 0);
        if (s.pets.length >= 6) {
          own('pettedTooMuch', 'annoyed', {}, 0);
          mem.trust = Math.max(0, mem.trust - 0.04);
          s.pets = [];
        } else {
          setMoodFor('love', 5000);
          if (s.pets.length === 1 || Math.random() < 0.25) own('petted', 'love', {}, 2500);
          playSound('pop');
          heart();
        }
        saveMemory(mem);
      } else {
        s.mode = 'air';
        s.vx = clamp(drag.vx, -2600, 2600);
        s.vy = clamp(drag.vy, -2600, 2600);
        s.angV = clamp(drag.vx / 5, -1100, 1100);
        s.bounced = false;
        if (Math.hypot(s.vx, s.vy) > 1600) spill(3, Math.sign(s.vx));
        if (Math.hypot(s.vx, s.vy) > 1200) {
          mem.throws += 1;
          mem.trust = Math.max(0, mem.trust - 0.12);
          saveMemory(mem);
        }
        playSound('whoosh');
      }
      drag = null;
    };
    hit.addEventListener('pointerdown', onDown);
    addEventListener('pointerdown', onPageDown, { passive: true });
    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('pointerup', onUp);
    addEventListener('pointercancel', onUp);

    // ---------------- loop ----------------
    let raf = 0;
    let last = performance.now();
    let lastFast = 0;
    let lastSave = performance.now();
    let lastBalanceSay = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.04, (now - last) / 1000);
      last = now;
      const m = moodRef.current;
      if (s.moodUntil && now > s.moodUntil && s.activity !== 'sleep') {
        s.moodUntil = 0;
        setMood('happy');
      }

      // Needs drift.
      const asleep = s.activity === 'sleep' && s.mode === 'ground';
      const busy = s.activity === 'jacks' || s.activity === 'dance' || s.activity === 'play';
      s.energy = clamp(s.energy + dt * (asleep ? 0.05 : busy ? -0.004 : -0.0012), 0, 1);
      s.chai = clamp(s.chai - dt * (busy ? 0.006 : 0.0022), 0, 1);
      s.boredom = clamp(s.boredom + dt * (busy ? -0.08 : 0.01), 0, 1);
      s.lonely = clamp(s.lonely + dt * 0.006, 0, 1);
      s.curiosity = clamp(
        s.curiosity + dt * (s.activity === 'explore' || s.activity === 'read' ? -0.05 : 0.008),
        0,
        1,
      );
      if (now - lastSave > 15_000) {
        lastSave = now;
        saveMemory(mem);
      }

      // Scrolling hard: wake up and balance; a floor-stander hops.
      const balancing = s.mode === 'ground' && scroll.speed > 900;
      if (balancing && scroll.speed > 3000 && now - lastFast > 3000) {
        lastFast = now;
        wake();
        if (!s.ledge) {
          s.vy = -520;
          s.mode = 'air';
          feet.forEach((f) => (f.planted = false));
        } else if (now - lastBalanceSay > 30_000) {
          lastBalanceSay = now;
          own('balanceScroll', 'dizzy', {}, 8000);
        }
      }

      petFeet.kicking = false;
      let surfaceY = s.y;

      // ---------- physics by mode ----------
      if (s.mode === 'drag' && drag) {
        const tx = pointer.x + drag.dx;
        const ty = pointer.y + drag.dy;
        s.vx = (tx - s.x) / Math.max(dt, 0.001);
        s.x += (tx - s.x) * 0.5;
        s.y += (ty - s.y) * 0.5;
      } else if (s.mode === 'air') {
        s.vy += GRAVITY * dt;
        // Chaiman glides on the cape when falling (not when thrown hard).
        s.gliding = heroRef.current && s.vy > 140 && !s.bounced && Math.abs(s.angV) < 300;
        if (s.gliding) {
          s.vy = Math.min(s.vy, 230);
          s.vx *= 0.985;
        }
        const prevY = s.y;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vx *= 0.995;
        s.vy = Math.min(s.vy, 1900); // terminal velocity
        if (s.vy > 1100 && moodRef.current !== 'scared' && moodRef.current !== 'dizzy')
          setMoodFor('scared', 2500);
        s.ang += s.angV * dt;
        s.angV *= 0.995;
        if (s.x < 18) {
          s.x = 18;
          s.vx = Math.abs(s.vx) * 0.55;
          s.angV = -s.angV * 0.6;
          s.sloshV += 3;
          s.squash = 0.2;
        } else if (s.x > vw() - 18) {
          s.x = vw() - 18;
          s.vx = -Math.abs(s.vx) * 0.55;
          s.angV = -s.angV * 0.6;
          s.sloshV -= 3;
          s.squash = 0.2;
        }
        if (s.y < 100 && s.vy < 0) {
          s.y = 100;
          s.vy = Math.abs(s.vy) * 0.3;
        }
        if (s.vy > 0) {
          const hitL = ledges()
            .filter(
              (l) =>
                s.x > l.left + 6 &&
                s.x < l.right - 6 &&
                prevY <= l.top + 2 &&
                s.y >= l.top &&
                !(l.el && l.el === s.drop.el && now < s.drop.until),
            )
            .sort((a, b) =>
              a.key === s.goal?.key ? -1 : b.key === s.goal?.key ? 1 : a.top - b.top,
            )[0];
          if (hitL) land(hitL, s.vy);
        }
      } else if (s.mode === 'grapple') {
        // Fire the line, then zip up to the anchor and land on the ledge.
        const gp = s.grapple;
        gp.t += dt;
        const target = ledges().find((l) => l.key === gp.key);
        if (!target) {
          s.mode = 'air';
          s.vy = 0;
        } else {
          gp.ay = target.top;
          gp.ax = clamp(gp.ax, target.left + 16, target.right - 16);
          if (gp.t > 0.2) {
            const v = Math.min(950, (gp.t - 0.2) * 2600);
            const dx = gp.ax - s.x;
            const dy = gp.ay - s.y;
            const d = Math.hypot(dx, dy);
            if (d < 10) {
              s.x = gp.ax;
              s.y = gp.ay;
              s.softDrop = true;
              land(target, 260);
            } else {
              s.x += (dx / d) * v * dt;
              s.y += (dy / d) * v * dt;
              s.vx = (dx / d) * v;
            }
          }
        }
      } else if (s.mode === 'wall') {
        // Hand-over-hand up the side of the screen: pulses of pulling, hands and feet gripping.
        const w = s.wall;
        const wallX = w.side < 0 ? 6 : vw() - 6;
        s.x = wallX - w.side * 7;
        s.facing = w.side;
        const prevCycle = w.cycle;
        w.cycle += dt * 1.6;
        const pull = 0.5 - 0.5 * Math.cos(w.cycle * Math.PI * 2);
        s.y -= 115 * pull * dt * 2;
        if (Math.floor(w.cycle * 2) !== Math.floor(prevCycle * 2)) {
          const i = Math.floor(w.cycle * 2) % 2;
          w.grip[i] = s.y - HIP_H - 26; // the reaching hand grabs higher
          w.footGrip[i] = s.y - 2;
          if (Math.random() < 0.35) playSound('tick');
        }
        const target = ledges().find((l) => l.key === w.key);
        if (!target || s.y < 110) {
          s.mode = 'air';
          s.vx = -w.side * 90;
          s.vy = 0;
        } else if (s.y <= target.top + 18) {
          const nearEdge = w.side < 0 ? target.left : target.right;
          if (Math.abs(nearEdge - wallX) < 70) {
            s.mode = 'mantle';
            s.mantle = {
              t: 0,
              fromX: s.x,
              fromY: s.y,
              toX: nearEdge - w.side * 14,
              toY: target.top,
              edgeX: nearEdge,
              top: target.top,
              el: target.el,
            };
          } else if (s.y <= target.top - 4) {
            s.mode = 'air'; // push off the wall and leap across
            jumpTo(target, clamp(s.x - w.side * 60, target.left + 24, target.right - 24));
          }
        }
      } else if (s.mode === 'mantle') {
        const mt = s.mantle;
        const live = mt.el ? toLedge(mt.el) : null;
        if (live) {
          const dy = live.top - mt.top;
          mt.top = live.top;
          mt.toY = live.top;
          mt.fromY += dy;
        }
        mt.t = Math.min(1, mt.t + dt / 0.55);
        // Haul up first (hands on top), then roll over the lip.
        const up = ease(clamp(mt.t / 0.55, 0, 1));
        const over = ease(clamp((mt.t - 0.45) / 0.55, 0, 1));
        s.x = lerp(mt.fromX, mt.toX, over);
        s.y = lerp(mt.fromY, mt.toY - 4, up) + over * 4;
        if (mt.t >= 1 && live) {
          s.softDrop = true;
          land(live, 200);
          if (Math.random() < 0.5) own('mantled', 'excited', {}, 10_000);
        } else if (mt.t >= 1) {
          s.mode = 'air';
          s.vy = 0;
        }
      } else if (s.mode === 'hang') {
        // Grab the edge, lower down, dangle and swing, then let go.
        const hg = s.hang;
        const l = hg.el ? toLedge(hg.el) : null;
        hg.t += dt;
        if (!l) {
          s.mode = 'air';
          s.vy = 0;
        } else {
          const top = l.top;
          const edgeX = hg.out > 0 ? l.right : l.left;
          hg.edgeX = edgeX;
          const lower = ease(clamp(hg.t / 0.45, 0, 1));
          const swing =
            hg.t > 0.45 ? Math.sin((hg.t - 0.45) * 7) * 3 * Math.exp(-(hg.t - 0.45) * 2) : 0;
          s.x = lerp(edgeX - hg.out * 4, edgeX + hg.out * 6, lower) + swing;
          s.y = lerp(top, top + 47, lower); // hanging by the fingertips, rim peeking over the edge
          if (hg.t > 1.05) {
            s.mode = 'air';
            s.ledge = null;
            s.softDrop = true;
            s.vx = hg.out * 25;
            s.vy = 40;
            if (Math.random() < 0.4) own('hangDrop', 'excited', {}, 10_000);
          }
        }
      } else {
        // ---------- on the ground ----------
        const here = current();
        if (!here) {
          s.mode = 'air';
          s.vy = -120;
          s.ledge = null;
          feet.forEach((f) => (f.planted = false));
          if (Math.random() < 0.35) own('fellOff', 'curious', {}, 8000);
        } else {
          // The ledge carries it as the page scrolls; a sudden stop flings it (real inertia).
          if (s.ledgeTop) {
            const v = (here.top - s.ledgeTop) / Math.max(dt, 0.001);
            if (s.ledgeV < -700 && Math.abs(v) < Math.abs(s.ledgeV) * 0.3) {
              s.mode = 'air';
              s.ledge = null;
              s.vy = s.ledgeV * 0.55;
              s.vx = (Math.random() - 0.5) * 120;
              s.angV = (Math.random() - 0.5) * 500;
              s.ledgeTop = 0;
              s.ledgeV = 0;
              feet.forEach((f) => (f.planted = false));
              own('scrollFling', 'excited', {}, 6000);
            } else s.ledgeV = s.ledgeV * 0.6 + v * 0.4;
          }
          s.ledgeTop = here.top;
          s.y = here.top;
          s.x = here.left + s.offset;
          surfaceY = here.top;
          // Stuck detector: a goal but no real progress for 4 s -> give up, avoid it for a while.
          if (s.goal) {
            const moved = Math.hypot(s.x - s.progress.x, s.y - s.progress.y);
            if (moved > 25) s.progress = { x: s.x, y: s.y, at: now };
            else if (now - s.progress.at > 4000) {
              s.avoid.set(s.goal.key, now + 30_000);
              s.goal = null;
              s.until = 0;
              s.walkV = 0;
              s.progress.at = now;
              own('stuck', 'curious', {}, 20_000);
            }
          } else s.progress = { x: s.x, y: s.y, at: now };
          const speed = reduce
            ? 0
            : s.activity === 'flee'
              ? 190
              : s.activity === 'approach'
                ? SPEED[m] * 1.3
                : SPEED[m];
          let arrived = true;
          if (now < s.teeterUntil) {
            arrived = false; // windmilling at an edge, then a small step back
            if (now > s.teeterUntil - 250) walkToward(here, s.x - s.facing * 12, 40, dt);
          } else if (s.pendingJump) {
            arrived = false;
            s.absorb = Math.max(s.absorb, 5); // crouch
            s.walkV *= 0.8;
            if (now >= s.crouchUntil) {
              const tj = s.pendingJump;
              const l = ledges().find((x) => x.key === tj.key);
              s.pendingJump = null;
              if (l) {
                s.mode = 'air';
                jumpTo(l, tj.x);
              }
            }
          } else if (s.activity === 'flee') {
            arrived = false;
            walkToward(here, s.x + s.facing * 60, speed, dt);
            if (now > s.until) {
              s.activity = 'idle';
              s.until = 0;
            }
          } else if (s.goal) arrived = steer(dt, speed);
          else {
            s.walkV *= Math.max(0, 1 - dt * 8);
            s.offset += s.walkV * dt;
            s.x = here.left + s.offset;
          }

          if (s.mode === 'ground') {
            if (s.ledge) s.x = clamp(s.x, here.left + 3, here.right - 3);
            else s.x = clamp(s.x, 18, vw() - 18);
            s.offset = s.x - here.left;
          }

          if (arrived && s.mode === 'ground') {
            if (s.activity === 'play') {
              // Trot back and forth on the title, kicking the dots.
              const span = Math.max(20, here.right - here.left - 60);
              walkToward(here, here.left + 30 + (Math.sin(now / 900) * 0.5 + 0.5) * span, 110, dt);
              petFeet.kicking = true;
              if (Math.random() < 0.002) own('playDots', 'excited', {}, 30_000);
            }
            if (s.activity === 'refill') {
              const k = kettle();
              if (k && here.key === k.key) {
                s.chai = Math.min(1, s.chai + dt * 0.35);
                if (s.chai >= 1) {
                  own('refillDone', 'excited', {}, 0);
                  playSound('success');
                  s.until = 0;
                }
              }
            }
            if (s.activity === 'sleep') {
              if (m !== 'sleepy') setMood('sleepy');
              if (s.energy > 0.97) s.until = 0;
            }
            if (s.activity === 'approach') {
              s.facing = pointer.x > s.x ? 1 : -1;
              s.lonely = Math.max(0, s.lonely - dt * 0.2);
            }
            if (s.activity === 'perch') s.facing = s.perch.out;
            if (now > s.until && now > s.nextDecision && !reduce) {
              s.nextDecision = now + 600;
              decide(now);
            }
          }
        }
      }

      // Always on screen: clamp sideways, and if it ever ends up out of view, drop it back in.
      if (s.mode !== 'wall') s.x = clamp(s.x, 22, vw() - 22);
      if (s.mode === 'ground' && !s.ledge) s.offset = s.x;
      if ((s.y > vh() + 120 || s.y < -400) && s.mode !== 'drag') {
        s.mode = 'air';
        s.ledge = null;
        s.x = clamp(s.x, 60, vw() - 60);
        s.y = 40;
        s.vx = 0;
        s.vy = 0;
        feet.forEach((f) => (f.planted = false));
      }

      // ---------- body: pelvis spring, tilt, squash ----------
      const ground = s.mode === 'ground';
      const act = s.activity;
      const talking = now < s.talkUntil;
      const sitting = ground && !s.goal && (act === 'sit' || act === 'sleep' || act === 'perch');
      if (talking && ground && Math.abs(s.walkV) < 10 && !sitting)
        s.facing = pointer.x > s.x ? 1 : -1;
      const flip = s.facing;

      // Step bob: lowest with both feet down, highest mid-stride.
      const stepLift = Math.max(
        ...feet.map((f) => (f.planted ? 0 : Math.sin(Math.PI * clamp(f.t, 0, 1)))),
      );
      const breathe = Math.sin(now / 700) * 0.5;
      let hipTarget = s.y - HIP_H + breathe - stepLift * 1.6;
      if (sitting) hipTarget = s.y - (act === 'perch' ? 2 : 4);
      if (ground && act === 'jacks' && !s.goal) hipTarget -= Math.abs(Math.sin(now / 110)) * 7;
      if (ground && act === 'stretch' && !s.goal) hipTarget -= 2;
      if (s.mode === 'air' || s.mode === 'drag') hipTarget = s.y - HIP_H - 2;
      if (s.mode === 'hang') hipTarget = s.y - HIP_H - 4;
      if (s.mode === 'wall') hipTarget = s.y - HIP_H + 2;
      if (s.mode === 'mantle') hipTarget = s.y - HIP_H + 3;
      s.absorb *= Math.max(0, 1 - dt * 9);
      hipTarget += s.absorb;
      if (ground) {
        // A spring with a little lag: weight, bounce, and it lags behind a scrolling ledge.
        s.pelvisV += ((hipTarget - s.pelvisY) * 420 - s.pelvisV * 28) * dt;
        s.pelvisY += s.pelvisV * dt;
        if (Math.abs(hipTarget - s.pelvisY) > 60) s.pelvisY = hipTarget;
      } else {
        s.pelvisY = hipTarget;
        s.pelvisV = 0;
      }
      const P = { x: s.x, y: s.pelvisY };
      if (heroRef.current !== s.wasHero) {
        s.wasHero = heroRef.current;
        if (s.wasHero) {
          own('heroIntro', 'excited', {}, 0);
          s.squash = 0.25;
          playSound('boom');
        }
      }

      // Righting spring after a tumble.
      if (s.mode !== 'air') {
        if (Math.abs(s.ang) > 180) s.ang -= Math.sign(s.ang) * 360;
        s.angV += (-s.ang * 140 - s.angV * 12) * dt;
        s.ang += s.angV * dt;
      }
      const instVx = (s.x - s.prevX) / Math.max(dt, 0.001);
      const ax = instVx - s.worldVx;
      s.worldVx = s.worldVx * 0.75 + instVx * 0.25;
      s.prevX = s.x;

      let tilt =
        s.mode === 'air'
          ? clamp(s.vx / 60, -25, 25)
          : s.mode === 'drag'
            ? clamp(s.vx / 80, -30, 30)
            : ground
              ? clamp(s.walkV / 16, -8, 8) + clamp(ax / 900, -6, 6)
              : 0;
      tilt += s.ang;
      if (ground && now < s.teeterUntil) tilt += Math.sin(now / 70) * 9 * flip;
      if (m === 'scared') tilt += Math.sin(now / 28) * 2.2;
      if (m === 'silly' && ground && !s.goal) tilt += Math.sin(now / 140) * 7;
      if (ground && act === 'dance' && !s.goal) tilt += Math.sin(now / 160) * 10;
      if (ground && act === 'read' && !s.goal) tilt += 6 * flip;
      if (ground && act === 'look' && !s.goal) tilt += Math.sin(now / 600) * 5;
      if (balancing) tilt += Math.sin(now / 90) * Math.min(10, scroll.speed / 400);
      if (s.mode === 'wall') tilt = s.wall.side * 6;
      if (s.mode === 'hang') tilt = -s.hang.out * 4 + Math.sin(s.hang.t * 7) * 3;

      s.squash *= 0.86;
      const speedNow = Math.hypot(s.vx, s.vy);
      const airStretch = s.mode === 'air' ? clamp(speedNow / 5000, 0, 0.22) : 0;
      const sq = s.squash - airStretch;
      const sx = 1 + sq;
      const sy = (1 - sq * 1.2) * (ground && act === 'stretch' && !s.goal ? 1.08 : 1);
      const cOff = s.mode === 'air' || s.mode === 'drag' ? 22 : 0; // spin about the middle in the air
      const rad = (tilt * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const toWorld = (lx: number, ly: number) => {
        const x0 = (lx - 30) * K * flip * sx;
        const y0 = (ly - 61) * K * sy + cOff;
        return { x: P.x + x0 * cos - y0 * sin, y: P.y - cOff + x0 * sin + y0 * cos };
      };
      body.setAttribute(
        'transform',
        `translate(${P.x.toFixed(2)} ${(P.y - cOff).toFixed(2)}) rotate(${tilt.toFixed(2)}) translate(0 ${cOff}) scale(${(flip * K * sx).toFixed(4)} ${(K * sy).toFixed(4)}) translate(-30 -61)`,
      );
      cupTop = toWorld(30, 22);

      // ---------- legs: planted feet + stepping ----------
      const hips = [toWorld(25, 61), toWorld(35, 61)];
      const stepping = ground && !sitting && !(act === 'jacks' && !s.goal);
      if (stepping) {
        const v = s.walkV;
        feet.forEach((f, i) => {
          const other = feet[1 - i]!;
          const ideal = s.x + (i === 0 ? -3.6 : 3.6) * flip + v * 0.1;
          if (f.planted) {
            f.y = surfaceY;
            const need = Math.max(3.5, Math.abs(v) * 0.05 + 4);
            if (Math.abs(f.x - ideal) > need && (other.planted || other.t > 0.6)) {
              f.planted = false;
              f.fromX = f.x;
              f.fromY = f.y;
              f.toX = ideal + v * 0.07;
              f.toY = surfaceY;
              f.t = 0;
              f.dur = clamp(0.24 - Math.abs(v) / 900, 0.11, 0.24);
            }
          } else {
            f.t = Math.min(1, f.t + dt / f.dur);
            f.toY = surfaceY;
            const lift = 3.5 + Math.abs(v) * 0.025;
            f.x = lerp(f.fromX, f.toX, ease(f.t));
            f.y = lerp(f.fromY, f.toY, f.t) - Math.sin(Math.PI * f.t) * lift;
            if (f.t >= 1) {
              f.planted = true;
              f.y = surfaceY;
            }
          }
          // Foot tap: the front foot pats the ground.
          if (act === 'tap' && !s.goal && i === (flip > 0 ? 1 : 0) && f.planted)
            f.y = surfaceY - Math.max(0, Math.sin(now / 110)) * 2.5;
        });
      } else {
        // Free feet: spring toward a pose target.
        feet.forEach((f, i) => {
          const side = i === 0 ? -1 : 1;
          const hip = hips[i]!;
          let tx = hip.x;
          let ty = hip.y + 14;
          if (sitting && act === 'perch') {
            // Legs dangling over the edge, kicking.
            const kick = Math.sin(now / 260 + i * Math.PI);
            tx = P.x + flip * (6 + side * 1.5) + kick * 2.5;
            ty = surfaceY + 11 + kick * 2;
          } else if (sitting) {
            tx = P.x + flip * 9 + side * 2.5;
            ty = surfaceY;
          } else if (ground && act === 'jacks') {
            const open = Math.abs(Math.sin(now / 110));
            tx = s.x + side * (3 + open * 6);
            ty = surfaceY;
          } else if (s.mode === 'air') {
            // Tuck going up, reach for the ground coming down.
            const reach = clamp(s.vy / 900, -1, 1);
            tx = hip.x + side * 2 - s.vx * 0.006;
            ty = hip.y + (reach > 0 ? 13 + reach * 2 : 9);
          } else if (s.mode === 'drag') {
            tx = hip.x - s.vx * 0.012 + Math.sin(now / 90 + i * 2) * 3;
            ty = hip.y + 14;
          } else if (s.mode === 'hang') {
            tx = hip.x + Math.sin(now / 200 + i * 1.7) * 3;
            ty = hip.y + 14;
          } else if (s.mode === 'wall') {
            const wallX = s.wall.side < 0 ? 6 : vw() - 6;
            tx = wallX - s.wall.side * 1.5;
            ty = Math.min(s.wall.footGrip[i]!, hip.y + 14);
          } else if (s.mode === 'mantle') {
            tx = hip.x - flip * 4;
            ty = hip.y + 12;
          }
          const k = Math.min(1, dt * 22);
          f.x += (tx - f.x) * k;
          f.y += (ty - f.y) * k;
          f.planted = false;
          f.t = 1;
        });
      }
      feet.forEach((f, i) => {
        const h = hips[i]!;
        const j = ik(h.x, h.y, f.x, f.y, THIGH, SHIN, flip);
        legPaths[i]!.setAttribute(
          'd',
          `M${h.x.toFixed(2)} ${h.y.toFixed(2)} L${j.jx.toFixed(2)} ${j.jy.toFixed(2)} L${j.ex.toFixed(2)} ${j.ey.toFixed(2)}`,
        );
        const footAng = (Math.atan2(j.ey - j.jy, j.ex - j.jx) * 180) / Math.PI - 90;
        footEls[i]!.setAttribute(
          'transform',
          `translate(${(j.ex + flip * 1.4).toFixed(2)} ${(j.ey + 1).toFixed(2)}) rotate(${(f.planted ? 0 : clamp(footAng * 0.4, -30, 30)).toFixed(1)})`,
        );
      });

      // ---------- arms ----------
      const shoulders = [toWorld(16.5, 38), toWorld(43.5, 38)];
      const front = flip > 0 ? 1 : 0;
      const swing = feet[1]!.x - feet[0]!.x;
      const hangTop = s.hang.el ? (toLedge(s.hang.el)?.top ?? 0) : 0;
      shoulders.forEach((sh, i) => {
        const side = sh.x < P.x ? -1 : 1;
        let tx = sh.x + side * 2.5 - swing * 0.35 * (i === 0 ? 1 : -1);
        let ty = sh.y + 10;
        const isFront = i === front;
        if (s.mode === 'air' && s.gliding) {
          tx = sh.x + side * 10; // holding the cape out
          ty = sh.y - 3;
        } else if (s.mode === 'air') {
          tx = sh.x + side * 7;
          ty = sh.y - 7 + Math.sin(now / 70 + i) * 2;
        } else if (s.mode === 'grapple') {
          const dx = s.grapple.ax - sh.x;
          const dy = s.grapple.ay - sh.y;
          const d = Math.hypot(dx, dy) || 1;
          tx = sh.x + (dx / d) * (isFront ? 11 : 6);
          ty = sh.y + (dy / d) * (isFront ? 11 : 6);
        } else if (s.mode === 'drag') {
          tx = sh.x + side * 6 + Math.sin(now / 60 + i * 2) * 3;
          ty = sh.y - 8;
        } else if (s.mode === 'wall') {
          const wallX = s.wall.side < 0 ? 6 : vw() - 6;
          tx = wallX - s.wall.side;
          ty = Math.min(s.wall.grip[i]!, sh.y + 4);
        } else if (s.mode === 'hang') {
          tx = s.hang.edgeX - s.hang.out * (1.5 + i * 3);
          ty = (hangTop || sh.y) + 0.5;
        } else if (s.mode === 'mantle') {
          tx = s.mantle.edgeX - (s.mantle.toX < s.mantle.edgeX ? 1 : -1) * (3 + i * 3);
          ty = s.mantle.top + 0.5;
        } else if (now < s.teeterUntil) {
          const a = now / 55 + i * Math.PI;
          tx = sh.x + Math.cos(a) * 8;
          ty = sh.y + Math.sin(a) * 8;
        } else if (balancing) {
          tx = sh.x + side * 9;
          ty = sh.y - 2 + Math.sin(now / 80 + i) * 3;
        } else if (!s.goal) {
          switch (act) {
            case 'stretch':
            case 'yawn':
              tx = sh.x + side * 1.5;
              ty = sh.y - 11;
              break;
            case 'jacks': {
              const open = Math.abs(Math.sin(now / 110));
              tx = sh.x + side * (4 + open * 4);
              ty = sh.y + 6 - open * 16;
              break;
            }
            case 'dance':
              tx = sh.x + side * 6;
              ty = sh.y - 4 + Math.sin(now / 160 + i * Math.PI) * 7;
              break;
            case 'approach':
            case 'waveOthers':
              if (isFront) {
                tx = sh.x + side * 3 + Math.sin(now / 110) * 3.5;
                ty = sh.y - 10;
              }
              break;
            case 'refill':
              tx = sh.x + flip * 5;
              ty = sh.y + 3;
              break;
            case 'read':
              tx = P.x + flip * 6 + (isFront ? 1 : -1);
              ty = sh.y + 6;
              break;
            case 'scratch':
              if (isFront) {
                const rim = toWorld(36, 23);
                tx = rim.x + Math.sin(now / 60) * 1.5;
                ty = rim.y;
              }
              break;
            case 'perch':
            case 'sit':
            case 'sleep':
              tx = sh.x + side * 3;
              ty = sh.y + 9;
              break;
          }
        }
        // Talking: the front hand gestures.
        if (ground && !s.goal && act === 'signal') {
          tx = sh.x + side * 2;
          ty = sh.y - 11;
        }
        if (ground && !s.goal && act === 'rang' && isFront) {
          tx = sh.x + flip * 10;
          ty = sh.y - 4 + Math.sin(now / 90) * 2;
        }
        if (talking && isFront && ground && act !== 'refill') {
          tx = sh.x + flip * 6 + Math.sin(now / 170) * 2;
          ty = sh.y - 1 + Math.cos(now / 230) * 3;
        }
        const hd = hands[i]!;
        const gripping = s.mode === 'wall' || s.mode === 'hang' || s.mode === 'mantle';
        const k = Math.min(1, dt * (gripping ? 30 : 16));
        hd.x += (tx - hd.x) * k;
        hd.y += (ty - hd.y) * k;
        const j = ik(sh.x, sh.y, hd.x, hd.y, UPPER, FORE, -flip);
        armPaths[i]!.setAttribute(
          'd',
          `M${sh.x.toFixed(2)} ${sh.y.toFixed(2)} L${j.jx.toFixed(2)} ${j.jy.toFixed(2)} L${j.ex.toFixed(2)} ${j.ey.toFixed(2)}`,
        );
        handEls[i]!.setAttribute('cx', j.ex.toFixed(2));
        handEls[i]!.setAttribute('cy', j.ey.toFixed(2));
        if (isFront) handPos = { x: j.ex, y: j.ey };
      });

      // ---------- Chaiman: cape and grapple line ----------
      if (heroRef.current) {
        const sL = toWorld(17, 31);
        const sR = toWorld(43, 31);
        const glide = s.gliding && s.mode === 'air';
        const trail = clamp(-s.worldVx * 0.05 - (s.mode === 'air' ? s.vx * 0.012 : 0), -16, 16);
        const spread = glide ? 18 : 3 + Math.min(6, Math.abs(trail) * 0.3);
        const by = glide ? P.y - 2 : P.y + 9 - Math.abs(trail) * 0.3;
        const flap =
          Math.sin(now / 110) * (1 + Math.min(3, Math.abs(s.worldVx) / 60) + (glide ? 2 : 0));
        const bL = { x: sL.x - spread + trail, y: by + flap * 0.4 };
        const bR = { x: sR.x + spread + trail, y: by - flap * 0.4 };
        const w = bR.x - bL.x;
        const sc = (k: number) => bL.x + w * k;
        cape.setAttribute(
          'd',
          `M${sL.x.toFixed(1)} ${sL.y.toFixed(1)} L${sR.x.toFixed(1)} ${sR.y.toFixed(1)} ` +
            `Q${(sR.x + spread * 0.7 + trail * 0.5).toFixed(1)} ${((sR.y + by) / 2).toFixed(1)} ${bR.x.toFixed(1)} ${bR.y.toFixed(1)} ` +
            `Q${sc(0.83).toFixed(1)} ${(by - 4 + flap).toFixed(1)} ${sc(0.66).toFixed(1)} ${(by + 1).toFixed(1)} ` +
            `Q${sc(0.5).toFixed(1)} ${(by - 4 - flap).toFixed(1)} ${sc(0.33).toFixed(1)} ${(by + 1).toFixed(1)} ` +
            `Q${sc(0.17).toFixed(1)} ${(by - 4 + flap).toFixed(1)} ${bL.x.toFixed(1)} ${bL.y.toFixed(1)} ` +
            `Q${(sL.x - spread * 0.7 + trail * 0.5).toFixed(1)} ${((sL.y + by) / 2).toFixed(1)} ${sL.x.toFixed(1)} ${sL.y.toFixed(1)} Z`,
        );
        cape.style.display = '';
        if (s.mode === 'grapple') {
          const ext = clamp(s.grapple.t / 0.2, 0, 1);
          rope.setAttribute('x1', handPos.x.toFixed(1));
          rope.setAttribute('y1', handPos.y.toFixed(1));
          rope.setAttribute('x2', lerp(handPos.x, s.grapple.ax, ext).toFixed(1));
          rope.setAttribute('y2', lerp(handPos.y, s.grapple.ay, ext).toFixed(1));
          rope.style.display = '';
        } else rope.style.display = 'none';
      } else {
        cape.style.display = 'none';
        rope.style.display = 'none';
      }

      petFeet.x = s.x;
      petFeet.y = s.y;
      svg.dataset.activity = s.activity;
      svg.dataset.mode = s.mode;
      svg.dataset.goal = s.goal ? s.goal.key : '';

      // ---------- chai, steam, face ----------
      const worldTarget =
        clamp(-ax / 2600, -0.45, 0.45) + (s.mode === 'drag' ? Math.sin(now / 90) * 0.15 : 0);
      const sloshTarget = flip * (worldTarget - rad);
      s.sloshV += ((sloshTarget - s.slosh) * 70 - s.sloshV * 4.5) * dt;
      s.slosh = clamp(s.slosh + s.sloshV * dt, -0.9, 0.9);
      const level = s.chai;
      const top = 60 - level * 27;
      const tan = Math.tan(s.slosh);
      const ripple = Math.sin(now / 160) * 0.7 * clamp(Math.abs(s.sloshV) / 3 + 0.25, 0, 1.2);
      const yL = top - tan * 18;
      const yR = top + tan * 18;
      const ctrl = top + ripple * 2;
      if (level > 0.02) {
        chai.setAttribute(
          'd',
          `M8 ${yL.toFixed(2)} Q30 ${ctrl.toFixed(2)} 52 ${yR.toFixed(2)} L52 66 L8 66 Z`,
        );
        foam.setAttribute('d', `M8 ${yL.toFixed(2)} Q30 ${ctrl.toFixed(2)} 52 ${yR.toFixed(2)}`);
        foam.style.display = '';
      } else {
        chai.setAttribute('d', 'M0 0');
        foam.style.display = 'none';
      }
      steamG.setAttribute(
        'transform',
        `translate(30 22) skewX(${clamp(-s.worldVx / 12, -30, 30).toFixed(1)}) translate(-30 -22)`,
      );

      // Mouth: flaps while talking, yawns, otherwise the mood's shape.
      if (talking) {
        const open = Math.floor(now / 85 + Math.sin(now / 37)) % 2 === 0;
        mouth.setAttribute('d', open ? MOUTH_OPEN : MOUTHS[m]);
        mouth.setAttribute('fill', open ? '#000' : 'none');
      } else if (act === 'yawn' && !s.goal && ground) {
        mouth.setAttribute('d', 'M27 48.5 a3 4 0 1 0 6 0 a3 4 0 1 0 -6 0');
        mouth.setAttribute('fill', '#000');
      } else {
        mouth.setAttribute('d', MOUTHS[m]);
        mouth.setAttribute('fill', m === 'excited' ? '#000' : 'none');
      }

      // Eyes: follow the pointer, scan while reading, look around, blink, close when asleep.
      const reading = ground && act === 'read' && !s.goal;
      const looking = ground && act === 'look' && !s.goal;
      const ex = reading
        ? Math.sin(now / 350) * 1.7
        : looking
          ? Math.sin(now / 500) * 1.8
          : clamp((pointer.x - s.x) / 120, -1.8, 1.8) * flip;
      const ey = reading ? 1.2 : looking ? -0.6 : clamp((pointer.y - (P.y - 20)) / 160, -1.4, 1.6);
      svg
        .querySelectorAll('[data-part=pupil]')
        .forEach((p) =>
          p.setAttribute('transform', `translate(${ex.toFixed(2)} ${ey.toFixed(2)})`),
        );
      if (now > s.blinkAt) s.blinkAt = now + 2200 + Math.random() * 3500;
      const blinking = s.blinkAt - now > 5580;
      const closed =
        (ground && act === 'sleep' && !s.goal) || blinking || (act === 'yawn' && !s.goal);
      svg
        .querySelectorAll('[data-part=lid]')
        .forEach((lid) =>
          lid.setAttribute(
            'height',
            closed ? '8.6' : m === 'sleepy' ? '4' : m === 'proud' ? '3.4' : '0',
          ),
        );
      svg
        .querySelectorAll('[data-part=pupil]')
        .forEach((p) => p.setAttribute('r', m === 'scared' ? '1.2' : m === 'shy' ? '1.6' : '1.9'));

      // ---------- shadow & bubble ----------
      let groundY = s.y;
      if (!ground) {
        const below = ledges()
          .filter((l) => s.x > l.left && s.x < l.right && l.top >= s.y - 2)
          .sort((a, b) => a.top - b.top)[0];
        groundY = below ? below.top : floorY();
      }
      const height = Math.max(0, groundY - s.y);
      const shScale = clamp(1 - height / 420, 0.25, 1) * (1 + s.absorb * 0.04);
      shadow.style.transform = `translate3d(${(s.x - 22).toFixed(1)}px, ${(groundY - 5).toFixed(1)}px, 0) scale(${shScale.toFixed(2)})`;
      shadow.style.opacity = (
        s.mode === 'wall' ? 0 : clamp(1 - height / 500, 0.15, 1) * 0.9
      ).toFixed(2);

      if (bubbleRef.current) {
        const headY = P.y - 48;
        const bx = clamp(s.x, 150, vw() - 150);
        const bh = bubbleRef.current.offsetHeight || 60;
        const above = headY - 14 - bh > 8;
        const by = above ? headY - 14 - bh : P.y + 22;
        bubbleRef.current.style.transform = `translate3d(${(bx - 140).toFixed(1)}px, ${by.toFixed(1)}px, 0)`;
        if (tailRef.current) {
          tailRef.current.style.left = `${clamp(s.x - (bx - 140), 20, 260).toFixed(1)}px`;
          tailRef.current.style.top = above ? 'auto' : '-8px';
          tailRef.current.style.bottom = above ? '-8px' : 'auto';
          tailRef.current.style.transform = `translateX(-50%) rotate(${above ? 45 : 225}deg)`;
        }
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      saveMemory(mem);
      petFeet.kicking = false;
      hit.removeEventListener('pointerdown', onDown);
      removeEventListener('pointerdown', onPageDown);
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerup', onUp);
      removeEventListener('pointercancel', onUp);
      api.current = null;
    };
  }, [hidden]);

  useEffect(() => {
    if (!line) return;
    const id = setTimeout(() => setLine(null), 4200 + line.text.length * 45);
    return () => clearTimeout(id);
  }, [line]);

  if (hidden) return null;
  const love = mood === 'love';
  const dizzy = mood === 'dizzy';
  const steam = mood === 'excited' ? 3 : mood === 'sleepy' || mood === 'sad' ? 1 : 2;

  return (
    <>
      <div
        ref={bubbleRef}
        aria-live="polite"
        className="pointer-events-none fixed top-0 left-0 z-[78] w-[280px]"
        style={{ transform: 'translate3d(-999px,-999px,0)' }}
      >
        {line && (
          <div key={line.id} className="cc-pet-bubble relative mx-auto w-fit max-w-[280px]">
            <button
              type="button"
              onClick={() => setLine(null)}
              className="pointer-events-auto relative z-10 block border-[3px] border-[#000] bg-white px-3.5 py-2.5 text-left text-[0.92rem] leading-snug font-semibold text-[#000] shadow-[4px_4px_0_0_#ff4fd8]"
            >
              <Typed text={line.text} />
            </button>
          </div>
        )}
        {line && (
          <span
            ref={tailRef}
            aria-hidden
            className="absolute z-20 size-3.5 border-r-[3px] border-b-[3px] border-[#000] bg-white"
          />
        )}
      </div>
      <div
        ref={shadowRef}
        aria-hidden
        className="pointer-events-none fixed top-0 left-0 z-[76] h-2.5 w-11 rounded-[50%]"
        style={{
          transform: 'translate3d(-200px,-200px,0)',
          background: 'radial-gradient(closest-side, rgb(80 0 60 / 0.45), rgb(80 0 60 / 0))',
        }}
      />
      <svg
        ref={svgRef}
        role="img"
        aria-label={`Chai, the site's pet. It's feeling ${mood}. Tap to pet, drag to pick up.`}
        className="pointer-events-none fixed inset-0 z-[77] h-full w-full overflow-visible"
      >
        <defs>
          <linearGradient id="cc-pet-chai" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff8ee6" />
            <stop offset="0.45" stopColor="#ff4fd8" />
            <stop offset="1" stopColor="#b0107f" />
          </linearGradient>
          <linearGradient id="cc-pet-glass" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="0.5" stopColor="#fff2fa" stopOpacity="0.9" />
            <stop offset="1" stopColor="#ffe3f4" stopOpacity="0.95" />
          </linearGradient>
          <clipPath id="cc-pet-inside">
            <path d="M14.3 23 H45.7 L42.3 58.8 a2.4 2.4 0 0 1 -2.4 2.1 H20.1 a2.4 2.4 0 0 1 -2.4 -2.1 Z" />
          </clipPath>
          {/* A thin white outline around the whole pet so it reads on any background. */}
          <filter id="cc-pet-outline" x="-30%" y="-30%" width="160%" height="160%">
            <feMorphology in="SourceAlpha" operator="dilate" radius="1.1" result="grown" />
            <feFlood floodColor="#fff" />
            <feComposite in2="grown" operator="in" result="ring" />
            <feMerge>
              <feMergeNode in="ring" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g filter="url(#cc-pet-outline)">
          {/* Chaiman's cape and grapple line (hidden off the Games page) */}
          <line
            data-part="rope"
            stroke="#ff4fd8"
            strokeWidth="1.6"
            strokeDasharray="3 2"
            style={{ display: 'none' }}
          />
          <path
            data-part="cape"
            fill="#111"
            stroke="#ff4fd8"
            strokeWidth="1.6"
            strokeLinejoin="round"
            style={{ display: 'none' }}
          />
          {/* Legs, behind the cup */}
          <g
            stroke="#000"
            strokeWidth="2.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          >
            <path data-part="legL" d="M0 0" />
            <path data-part="legR" d="M0 0" />
          </g>
          <ellipse data-part="footL" rx="3.6" ry="2.1" fill="#000" />
          <ellipse data-part="footR" rx="3.6" ry="2.1" fill="#000" />

          {/* The cup, drawn in its own units and placed by one transform each frame */}
          <g data-part="body">
            <g data-part="steam">
              {Array.from({ length: steam }, (_, i) => (
                <path
                  key={i}
                  className="cc-pet-steam"
                  style={{ animationDelay: `${i * 0.6}s` }}
                  d={`M${24 + i * 6} 18 c-3 -4 3 -6 0 -10 s3 -5 0 -8`}
                  stroke={mood === 'annoyed' ? '#000' : '#ff4fd8'}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  fill="none"
                />
              ))}
            </g>
            <path
              d="M13 22 H47 L43.2 59.5 a3 3 0 0 1 -3 2.6 H19.8 a3 3 0 0 1 -3 -2.6 Z"
              fill="url(#cc-pet-glass)"
              stroke="#000"
              strokeWidth="2.6"
              strokeLinejoin="round"
            />
            <g clipPath="url(#cc-pet-inside)">
              <path data-part="chai" d="M8 33 L52 33 L52 66 L8 66 Z" fill="url(#cc-pet-chai)" />
              <path
                data-part="foam"
                d="M8 33 L52 33"
                stroke="#ffd2f2"
                strokeWidth="2.4"
                fill="none"
                strokeLinecap="round"
              />
              {[19.5, 24.8, 30, 35.2, 40.5].map((x, i) => (
                <path
                  key={x}
                  d={`M${x} 22 L${30 + (x - 30) * 0.8} 61`}
                  stroke={i % 2 ? '#000' : '#fff'}
                  strokeOpacity={i % 2 ? 0.1 : 0.5}
                  strokeWidth="1.1"
                />
              ))}
              <path d="M16 56.5 H44" stroke="#fff" strokeOpacity="0.35" strokeWidth="3" />
              {hero && (
                <>
                  <rect x="8" y="53.5" width="44" height="4.6" fill="#111" />
                  <rect
                    x="27"
                    y="53"
                    width="6"
                    height="5.6"
                    rx="1"
                    fill="#ffd84d"
                    stroke="#000"
                    strokeWidth="0.8"
                  />
                  {[17, 22, 38, 43].map((x) => (
                    <rect
                      key={x}
                      x={x - 1.6}
                      y="53.9"
                      width="3.2"
                      height="3.8"
                      rx="0.8"
                      fill="#ff4fd8"
                    />
                  ))}
                </>
              )}
            </g>
            <path
              d="M17.8 26 L20.2 55"
              stroke="#fff"
              strokeWidth="2.4"
              strokeLinecap="round"
              opacity="0.85"
            />
            <path
              d="M42.6 27 L41.4 40"
              stroke="#fff"
              strokeWidth="1.4"
              strokeLinecap="round"
              opacity="0.6"
            />
            <ellipse
              cx="30"
              cy="22"
              rx="18.4"
              ry="2.3"
              fill="#fff"
              stroke="#000"
              strokeWidth="2.4"
            />
            <path
              d="M15 21.4 Q22 20.4 27 20.8"
              stroke="#ff4fd8"
              strokeOpacity="0.5"
              strokeWidth="1"
              fill="none"
            />
            {hero && (
              <>
                {/* Cowl: pointy ears over the rim and a mask across the eyes. */}
                <path
                  d="M17 23 L19.5 8.5 L25.5 22 Z"
                  fill="#111"
                  stroke="#000"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <path
                  d="M43 23 L40.5 8.5 L34.5 22 Z"
                  fill="#111"
                  stroke="#000"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <path d="M14.2 34 H45.8 L44.8 46.5 Q30 50.5 15.2 46.5 Z" fill="#111" />
                <path d="M15 23.5 H45" stroke="#111" strokeWidth="2.4" />
              </>
            )}
            {(['L', 'R'] as const).map((side) => {
              const cx = side === 'L' ? 24.5 : 35.5;
              return (
                <g key={side}>
                  {dizzy ? (
                    <path
                      d={`M${cx - 2.5} 39.5 l5 5 m0 -5 l-5 5`}
                      stroke="#000"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  ) : love ? (
                    <path
                      d={`M${cx} 45 l-3.2 -3.2 a1.9 1.9 0 0 1 3.2 -2.4 a1.9 1.9 0 0 1 3.2 2.4 Z`}
                      fill="#000"
                    />
                  ) : (
                    <>
                      <circle cx={cx} cy="42" r="3.9" fill="#fff" stroke="#000" strokeWidth="1.4" />
                      <circle data-part="pupil" cx={cx} cy="42" r="1.9" fill="#000" />
                      <rect
                        data-part="lid"
                        x={cx - 4.3}
                        y="37.8"
                        width="8.6"
                        height="0"
                        rx="2"
                        fill="#fff"
                        stroke="#000"
                        strokeWidth="1"
                      />
                    </>
                  )}
                </g>
              );
            })}
            {mood === 'annoyed' && (
              <path
                d="M21 36.5 L27 38.5 M39 36.5 L33 38.5"
                stroke="#000"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            )}
            <path
              data-part="mouth"
              d={MOUTHS[mood]}
              stroke="#000"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
            />
            {(mood === 'shy' || mood === 'love') && (
              <>
                <ellipse cx="19.5" cy="48.5" rx="3" ry="1.7" fill="#ff4fd8" opacity="0.8" />
                <ellipse cx="40.5" cy="48.5" rx="3" ry="1.7" fill="#ff4fd8" opacity="0.8" />
              </>
            )}
            {mood === 'silly' && (
              <path
                d="M30 51.5 q0 5 2.6 4.6 q2.4 -0.4 0.6 -4.4 Z"
                fill="#ff4fd8"
                stroke="#000"
                strokeWidth="1"
              />
            )}
            {mood === 'scared' && (
              <path
                d="M44 30 q1.5 2.5 0 4"
                stroke="#7cd3ff"
                strokeWidth="1.6"
                strokeLinecap="round"
                fill="none"
              />
            )}
            {mood === 'sleepy' && (
              <text x="46" y="16" className="cc-pet-z" fontSize="9" fontWeight="900" fill="#000">
                z
              </text>
            )}
            {/* The grab area: the only part that takes touches. */}
            <g
              data-part="hit"
              className="cursor-grab active:cursor-grabbing"
              style={{ pointerEvents: 'all', touchAction: 'none' }}
            >
              <rect x="6" y="10" width="48" height="58" fill="transparent" />
            </g>
          </g>

          {/* Arms, in front of the cup */}
          <g
            stroke="#000"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          >
            <path data-part="armL" d="M0 0" />
            <path data-part="armR" d="M0 0" />
          </g>
          <circle data-part="handL" r="2.3" fill="#000" />
          <circle data-part="handR" r="2.3" fill="#000" />
        </g>
      </svg>
    </>
  );
}

function Typed({ text }: { text: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setN(i);
      if (i >= text.length) clearInterval(id);
    }, 20);
    return () => clearInterval(id);
  }, [text]);
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden>{text.slice(0, n)}</span>
    </>
  );
}
