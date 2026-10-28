'use client';

import { AnimatePresence, motion } from 'motion/react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { cn } from './cn';

type Tone = 'info' | 'success' | 'error';
interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((message: string, tone: Tone = 'info') => {
    const id = Date.now() + Math.random();
    setItems((list) => [...list.slice(-2), { id, message, tone }]);
    setTimeout(
      () => setItems((list) => list.filter((t) => t.id !== id)),
      tone === 'error' ? 6000 : 3500,
    );
  }, []);
  const value = useMemo(() => push, [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
      >
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className={cn(
                'pointer-events-auto flex max-w-md items-center gap-3 rounded-full px-5 py-3 text-sm font-medium shadow-[0_16px_40px_-16px_rgb(0_0_0_/_0.8)] ring-1',
                t.tone === 'error' && 'bg-prussian text-coral ring-coral/60',
                t.tone === 'success' && 'bg-plum text-ink ring-plum',
                t.tone === 'info' && 'bg-prussian text-petal ring-grape',
              )}
            >
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
