'use client';

import Link from 'next/link';
import {
  motion,
  useMotionTemplate,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'motion/react';
import { useRef } from 'react';
import { playSound } from '@/lib/sound';
import { Burst } from './loud';

export interface Scene {
  href: string;
  title: string;
  note: string;
  cta: string;
  live?: boolean;
}

/** Scene colours, alternating: black with pink type, pink with black type. */
const SKINS = [
  { bg: '#000000', fg: '#ff4fd8', sub: '#ffffff', btnBg: '#ff4fd8', btnFg: '#000000' },
  { bg: '#ff4fd8', fg: '#000000', sub: '#000000', btnBg: '#000000', btnFg: '#ff4fd8' },
];

/**
 * The home page's actions as full-screen scenes. The section pins while you scroll; each next
 * scene bursts out of the centre in a growing circle, its giant title zooms down into place and a
 * ghost copy slides across behind it. Reduced motion gets plain full-height panels instead.
 */
export function ScrollScenes({ scenes }: { scenes: Scene[] }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  // A soft spring between the finger and the motion: it glides instead of reacting to every jitter.
  const smooth = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.35 });
  // A whoosh each time the next scene starts bursting in.
  const lastScene = useRef(0);
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const n = scenes.length;
    const scene = Math.min(n - 1, Math.floor((v + 0.5 / n) * n));
    if (scene !== lastScene.current) {
      lastScene.current = scene;
      playSound(scene > 0 ? 'boom' : 'whoosh');
    }
  });

  if (reduce) {
    return (
      <section
        ref={ref}
        data-pet-skip
        aria-label="What you can do"
        className="relative left-1/2 w-screen -translate-x-1/2"
      >
        {scenes.map((s, i) => (
          <SceneBody key={s.href} scene={s} index={i} total={scenes.length} />
        ))}
      </section>
    );
  }

  return (
    <section
      ref={ref}
      data-pet-skip
      aria-label="What you can do"
      className="relative left-1/2 w-screen -translate-x-1/2"
      style={{ height: `${scenes.length * 110 + 20}svh` }}
    >
      <div className="sticky top-0 h-svh overflow-hidden bg-[#000]">
        {scenes.map((s, i) => (
          <ScenePanel key={s.href} scene={s} index={i} total={scenes.length} progress={smooth} />
        ))}
        <Progress total={scenes.length} progress={smooth} />
      </div>
    </section>
  );
}

function ScenePanel({
  scene,
  index,
  total,
  progress,
}: {
  scene: Scene;
  index: number;
  total: number;
  progress: MotionValue<number>;
}) {
  // Where this scene's slice of the scroll starts and ends (0..1).
  const start = index / total;
  const end = (index + 1) / total;
  const enter = Math.max(0, start - 0.5 / total);

  // Every scene after the first bursts out of the centre.
  const radius = useTransform(progress, [enter, start + 0.02], index === 0 ? [150, 150] : [0, 150]);
  const clip = useMotionTemplate`circle(${radius}% at 50% 55%)`;
  // Title zooms from huge to resting size; ghost slides across the whole slice.
  const scale = useTransform(progress, [enter, start + 0.12], index === 0 ? [1, 1] : [2.6, 1]);
  const ghostX = useTransform(progress, [enter, end], ['20%', '-60%']);
  const rotate = useTransform(progress, [enter, start + 0.12], index === 0 ? [0, 0] : [-8, 0]);
  // Text and button glide in after the title lands.
  const late = useTransform(progress, [start - 0.02, start + 0.1], index === 0 ? [1, 1] : [0, 1]);
  const lateY = useTransform(late, [0, 1], [40, 0]);
  // As the next scene bursts over this one, it sinks back and dims.
  const last = index === total - 1;
  const nextEnter = end - 0.5 / total;
  const sink = useTransform(progress, [nextEnter, end], last ? [1, 1] : [1, 0.86]);
  const shade = useTransform(progress, [nextEnter, end], last ? [0, 0] : [0, 0.55]);

  return (
    <motion.div className="absolute inset-0" style={{ clipPath: clip, zIndex: index }}>
      <motion.div className="relative h-full will-change-transform" style={{ scale: sink }}>
        <SceneBody
          scene={scene}
          index={index}
          total={total}
          scale={scale}
          rotate={rotate}
          late={late}
          lateY={lateY}
          ghostX={ghostX}
          pinned
        />
        {/* Darkens this scene as the next one covers it (cheaper than a CSS filter). */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[#000]"
          style={{ opacity: shade }}
        />
      </motion.div>
    </motion.div>
  );
}

function SceneBody({
  scene,
  index,
  total,
  scale,
  rotate,
  ghostX,
  late,
  lateY,
  pinned = false,
}: {
  scene: Scene;
  index: number;
  total: number;
  scale?: MotionValue<number>;
  rotate?: MotionValue<number>;
  ghostX?: MotionValue<string>;
  late?: MotionValue<number>;
  lateY?: MotionValue<number>;
  pinned?: boolean;
}) {
  const skin = SKINS[index % 2]!;
  return (
    <div
      className={`relative flex flex-col justify-center overflow-hidden px-4 sm:px-10 ${pinned ? 'h-full' : 'min-h-svh'}`}
      style={{ background: skin.bg, color: skin.fg }}
    >
      {/* Ghost copy of the title, outlined, sliding behind. */}
      <motion.span
        aria-hidden
        className="font-display pointer-events-none absolute top-[8%] left-0 text-[clamp(7rem,30vw,22rem)] leading-none font-black tracking-[-0.06em] whitespace-nowrap uppercase select-none"
        style={{
          x: ghostX,
          color: skin.bg,
          paintOrder: 'stroke fill',
          WebkitTextStroke: `4px ${skin.fg}`,
          opacity: 0.35,
        }}
      >
        {scene.title}
      </motion.span>

      <div className="relative mx-auto w-full max-w-6xl pr-8 sm:pr-14">
        <div
          className="font-display mb-4 flex items-center gap-3 text-sm font-black tracking-[0.25em] uppercase sm:text-base"
          style={{ color: skin.sub }}
        >
          <span>
            {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>
          <Burst className="size-4" />
          {scene.live && <span className="animate-pulse">Live now</span>}
        </div>

        <motion.h2
          className="font-display origin-left text-[clamp(2.7rem,12.4vw,10rem)] leading-[0.86] font-black tracking-[-0.06em] uppercase"
          style={{ scale, rotate }}
        >
          {scene.title}
        </motion.h2>

        <motion.div style={{ opacity: late, y: lateY }}>
          <p
            className="mt-6 max-w-md text-lg leading-snug font-medium sm:text-2xl"
            style={{ color: skin.sub, opacity: 0.85 }}
          >
            {scene.note}
          </p>

          <Link
            href={scene.href}
            className="group font-display mt-8 inline-flex items-center gap-4 px-6 py-4 text-lg font-black tracking-tight uppercase transition-transform active:scale-95 sm:mt-10 sm:px-8 sm:py-5 sm:text-2xl"
            style={{
              background: skin.btnBg,
              color: skin.btnFg,
              boxShadow: `6px 6px 0 0 ${skin.sub}`,
            }}
          >
            {scene.cta}
            <svg
              viewBox="0 0 24 24"
              className="size-6 transition-transform duration-300 group-hover:translate-x-2 sm:size-8"
              aria-hidden
            >
              <path d="M4 12h15m-7-7 7 7-7 7" stroke="currentColor" strokeWidth="3.2" fill="none" />
            </svg>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}

/** Three bars on the right edge that fill as you pass each scene. */
function Progress({ total, progress }: { total: number; progress: MotionValue<number> }) {
  return (
    <div
      aria-hidden
      className="absolute top-1/2 right-3 z-50 flex -translate-y-1/2 flex-col gap-2 sm:right-6"
    >
      {Array.from({ length: total }, (_, i) => (
        <Bar key={i} index={i} total={total} progress={progress} />
      ))}
    </div>
  );
}

function Bar({
  index,
  total,
  progress,
}: {
  index: number;
  total: number;
  progress: MotionValue<number>;
}) {
  const fill = useTransform(progress, [index / total, (index + 1) / total], [0, 1]);
  return (
    <span className="relative block h-10 w-1.5 overflow-hidden bg-white/30 mix-blend-difference sm:h-14">
      <motion.span className="absolute inset-0 origin-top bg-white" style={{ scaleY: fill }} />
    </span>
  );
}
