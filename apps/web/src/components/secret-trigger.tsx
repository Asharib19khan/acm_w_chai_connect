'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { playSound, unlockSound } from '@/lib/sound';
import { notify } from './notice-you';
import { SecretMirror } from './secret-mirror';

const HOLD_MS = 1500;

/**
 * Wraps the spinning sticker. Hold it for 1.5 s: it shakes harder and a ring fills, then the secret
 * dot mirror opens. No hint anywhere on the page; people find it and tell each other.
 */
export function SecretTrigger({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const [holding, setHolding] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef(0);

  const start = () => {
    unlockSound();
    setHolding(true);
    timer.current = window.setTimeout(() => {
      setHolding(false);
      setOpen(true);
      notify('secret');
    }, HOLD_MS);
  };
  const cancel = () => {
    clearTimeout(timer.current);
    setHolding(false);
  };
  const close = useCallback(() => {
    setOpen(false);
    playSound('open');
  }, []);

  return (
    <>
      <motion.div
        data-pet-ledge
        data-pet-kettle
        className={`${className} touch-none select-none`}
        onPointerDown={start}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        onContextMenu={(e) => e.preventDefault()}
        animate={
          holding ? { rotate: [0, -6, 6, -9, 9, -12, 12, 0], scale: 1.12 } : { rotate: 0, scale: 1 }
        }
        transition={
          holding
            ? { duration: HOLD_MS / 1000, ease: 'easeIn' }
            : { type: 'spring', stiffness: 300, damping: 15 }
        }
      >
        {children}
        <AnimatePresence>
          {holding && (
            <motion.svg
              viewBox="0 0 100 100"
              className="pointer-events-none absolute -inset-2 size-[calc(100%+1rem)] -rotate-90"
              exit={{ opacity: 0 }}
              aria-hidden
            >
              <motion.circle
                cx="50"
                cy="50"
                r="48"
                fill="none"
                stroke="#000"
                strokeWidth="3"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: HOLD_MS / 1000, ease: 'linear' }}
              />
            </motion.svg>
          )}
        </AnimatePresence>
      </motion.div>
      {open && <SecretMirror onClose={close} />}
    </>
  );
}
