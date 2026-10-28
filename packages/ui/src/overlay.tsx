'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

function useOverlayBehaviour(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])',
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
      const target = panelRef.current?.querySelector<HTMLElement>(
        '[autofocus],input,button,textarea',
      );
      target?.focus();
    });
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, onClose]);
  return panelRef;
}

/** Centered dialog, portalled to <body> so no transformed parent traps it. */
export function Modal({ open, onClose, title, description, children, className }: OverlayProps) {
  const panelRef = useOverlayBehaviour(open, onClose);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className="bg-ink/80 absolute inset-0 backdrop-blur-md"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.94, y: 12, filter: 'blur(8px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.97, y: 6, filter: 'blur(4px)' }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className={cn(
              'bg-prussian ring-grape relative w-full max-w-md rounded-[28px] p-6 shadow-[0_30px_80px_-30px_rgb(0_0_0_/_0.8)] ring-1 sm:p-8',
              className,
            )}
          >
            <h2 className="font-display text-petal text-xl font-semibold">{title}</h2>
            {description && <p className="text-petal-72 mt-2 text-sm">{description}</p>}
            <div className="mt-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Side panel from the right (bottom sheet on phones). */
export function Drawer({ open, onClose, title, description, children, className }: OverlayProps) {
  const panelRef = useOverlayBehaviour(open, onClose);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="bg-ink/70 absolute inset-0 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.aside
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 36 }}
            className={cn(
              'bg-prussian ring-grape absolute top-0 right-0 flex h-full w-full max-w-lg flex-col overflow-y-auto shadow-[-30px_0_80px_-30px_rgb(0_0_0_/_0.8)] ring-1',
              className,
            )}
          >
            <header className="bg-prussian/95 sticky top-0 z-10 flex items-start justify-between gap-4 px-6 pt-6 pb-4 backdrop-blur">
              <div>
                <h2 className="font-display text-petal text-xl font-semibold">{title}</h2>
                {description && <div className="text-petal-72 mt-1 text-sm">{description}</div>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="text-petal-72 ring-grape hover:text-petal hover:ring-plum grid size-10 shrink-0 place-items-center rounded-full ring-1"
              >
                <svg viewBox="0 0 24 24" className="size-4">
                  <path
                    d="M6 6l12 12M18 6 6 18"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </header>
            <div className="flex-1 px-6 pb-8">{children}</div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
