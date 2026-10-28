'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { useRef, useState, type MouseEvent } from 'react';
import { Marquee, cn } from '@chai/ui';

export interface MenuRow {
  href: string;
  title: string;
  note: string;
  band: string[];
  live?: boolean;
}

/**
 * Stall menu board (after React Bits' Flowing Menu): full-bleed rows; a Plum band carrying a
 * moving strip slides in from the edge the pointer entered and leaves the way it came.
 */
export function FlowingMenu({ rows }: { rows: MenuRow[] }) {
  return (
    <nav aria-label="What you can do" className="border-petal-12 border-t">
      {rows.map((row) => (
        <FlowingRow key={row.href} row={row} />
      ))}
    </nav>
  );
}

function FlowingRow({ row }: { row: MenuRow }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const reduce = useReducedMotion();
  const [state, setState] = useState<{ open: boolean; from: 'top' | 'bottom' }>({
    open: false,
    from: 'bottom',
  });

  const edge = (e: MouseEvent) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return 'bottom' as const;
    return e.clientY - box.top < box.height / 2 ? ('top' as const) : ('bottom' as const);
  };

  const offscreen = state.from === 'top' ? '-101%' : '101%';

  return (
    <Link
      ref={ref}
      href={row.href}
      onMouseEnter={(e) => setState({ open: true, from: edge(e) })}
      onMouseLeave={(e) => setState({ open: false, from: edge(e) })}
      onFocus={() => setState({ open: true, from: 'bottom' })}
      onBlur={() => setState((s) => ({ ...s, open: false }))}
      className="group border-petal-12 focus-visible:bg-petal-06 relative block overflow-hidden border-b outline-none"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-6 sm:px-8 sm:py-8">
        <div className="flex min-w-0 items-center gap-3">
          {row.live && (
            <span className="cc-live-dot bg-plum size-2.5 shrink-0 rounded-full" aria-hidden />
          )}
          <span className="font-display text-petal text-[clamp(1.6rem,6.4vw,3.6rem)] leading-[0.95] font-bold tracking-[-0.03em]">
            {row.title}
          </span>
        </div>
        <span className="text-petal-72 flex shrink-0 items-center gap-3 text-right text-sm">
          <span className="hidden max-w-56 sm:block">{row.note}</span>
          <svg
            viewBox="0 0 24 24"
            className="text-plum size-6 transition-transform duration-300 group-hover:translate-x-1"
            aria-hidden
          >
            <path
              d="M5 12h14m-6-6 6 6-6 6"
              stroke="currentColor"
              strokeWidth="2.2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
      <motion.div
        aria-hidden
        initial={false}
        animate={
          state.open
            ? { y: '0%', visibility: 'visible' }
            : { y: offscreen, transitionEnd: { visibility: 'hidden' } }
        }
        style={{ visibility: 'hidden' }}
        transition={reduce ? { duration: 0 } : { duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="bg-plum pointer-events-none absolute inset-0 flex items-center"
      >
        <motion.div
          initial={false}
          animate={{ y: state.open ? '0%' : state.from === 'top' ? '101%' : '-101%' }}
          transition={reduce ? { duration: 0 } : { duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="w-full"
        >
          <Marquee
            items={row.band}
            speed={70}
            className="font-display text-ink text-[clamp(1.6rem,6.4vw,3.6rem)] leading-none font-bold tracking-[-0.03em]"
            separator={<CupGlyph />}
          />
        </motion.div>
      </motion.div>
      <span className={cn('sr-only')}>{row.note}</span>
    </Link>
  );
}

function CupGlyph() {
  return (
    <svg viewBox="0 0 64 56" className="h-[0.7em] w-auto" aria-hidden>
      <path d="M10 6h44l-5.5 38a5 5 0 0 1-5 4.3H20.5a5 5 0 0 1-5-4.3L10 6Z" fill="currentColor" />
    </svg>
  );
}
