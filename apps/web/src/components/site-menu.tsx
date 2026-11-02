'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { playSound } from '@/lib/sound';
import { notify } from './notice-you';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/ask', label: 'Ask anything' },
  { href: '/cv', label: 'Drop your CV' },
  { href: '/games', label: 'Join the games' },
  { href: '/quiz', label: 'Quiz' },
  { href: '/privacy', label: 'Privacy' },
];

const ease = [0.76, 0, 0.24, 1] as const;
const noop = () => () => {};

/**
 * Top-right Menu button and its full-screen pink menu. The panel is portalled to <body> so no
 * transformed parent can trap it. Esc, the Close button, or picking a page closes it.
 */
export function SiteMenu() {
  const [open, setOpen] = useState(false);
  // True only in the browser, so the portal never renders during server rendering.
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const path = usePathname();
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', esc);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', esc);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          playSound('open');
          notify('menu');
        }}
        aria-expanded={open}
        aria-controls="site-menu"
        className="font-display group text-fg flex items-center gap-2.5 text-sm font-black tracking-[0.15em] uppercase"
      >
        Menu
        <span aria-hidden className="flex flex-col gap-[5px]">
          <span className="bg-fg block h-[3px] w-6 transition-transform group-hover:translate-x-1" />
          <span className="bg-accent block h-[3px] w-6 transition-transform group-hover:-translate-x-1" />
        </span>
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                id="site-menu"
                role="dialog"
                aria-modal="true"
                aria-label="Menu"
                className="bg-accent fixed inset-0 z-[95] flex flex-col overflow-y-auto px-4 pt-5 pb-8 text-[#000] sm:px-8"
                initial={reduce ? { opacity: 0 } : { clipPath: 'inset(0 0 100% 0)' }}
                animate={reduce ? { opacity: 1 } : { clipPath: 'inset(0 0 0% 0)' }}
                exit={reduce ? { opacity: 0 } : { clipPath: 'inset(100% 0 0 0)' }}
                transition={{ duration: 0.65, ease }}
              >
                <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
                  <span className="font-display text-[1.35rem] leading-none font-black tracking-[-0.02em]">
                    ACM-W
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    autoFocus
                    className="font-display flex items-center gap-2 text-sm font-black tracking-[0.15em] uppercase"
                  >
                    Close
                    <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
                      <path d="M5 5l14 14M19 5 5 19" stroke="currentColor" strokeWidth="3" />
                    </svg>
                  </button>
                </div>

                <nav className="mx-auto mt-10 flex w-full max-w-6xl flex-1 flex-col justify-center">
                  <ul>
                    {LINKS.map((l, i) => {
                      const here = l.href === path;
                      return (
                        <li key={l.href} className="overflow-hidden border-b-2 border-[#000]">
                          <motion.div
                            initial={reduce ? false : { y: '105%' }}
                            animate={{ y: 0 }}
                            transition={{
                              duration: 0.7,
                              delay: 0.2 + i * 0.06,
                              ease: [0.16, 1, 0.3, 1],
                            }}
                          >
                            <Link
                              href={l.href}
                              onClick={() => setOpen(false)}
                              aria-current={here ? 'page' : undefined}
                              className="group font-display flex items-baseline gap-4 py-3 text-[clamp(2.2rem,10vw,6rem)] leading-[0.95] font-black tracking-[-0.05em] uppercase sm:py-4"
                            >
                              <span className="w-8 shrink-0 text-base sm:w-14 sm:text-2xl">
                                {String(i + 1).padStart(2, '0')}
                              </span>
                              <span
                                className={`transition-transform duration-300 group-hover:translate-x-3 ${here ? 'cc-outline-black' : ''}`}
                              >
                                {l.label}
                              </span>
                            </Link>
                          </motion.div>
                        </li>
                      );
                    })}
                  </ul>
                </nav>

                <p className="font-display mx-auto mt-8 w-full max-w-6xl text-xs font-black tracking-[0.2em] uppercase sm:text-sm">
                  Chai Connect · 27 November · FAST-NUCES Karachi
                </p>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
