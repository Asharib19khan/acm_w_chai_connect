'use client';

import { LayoutGroup, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AnimatedNumber, EmptyState, cn } from '@chai/ui';

export interface Board {
  id: string;
  name: string;
  category: 'physical' | 'mini' | 'quiz';
  rows: { key: string; label: string; sub: string; score: number; rank: number }[];
}

export function Boards({ boards }: { boards: Board[] }) {
  const router = useRouter();
  const [active, setActive] = useState(boards[0]?.id ?? '');
  const board = boards.find((b) => b.id === active) ?? boards[0];

  // Live: refresh the server data every 8 s.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 8000);
    return () => clearInterval(id);
  }, [router]);

  return (
    <div className="flex flex-col gap-8">
      <LayoutGroup>
        <div
          role="tablist"
          aria-label="Games"
          className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
        >
          {boards.map((b) => (
            <button
              key={b.id}
              role="tab"
              aria-selected={b.id === active}
              onClick={() => setActive(b.id)}
              className={cn(
                'relative h-11 shrink-0 rounded-full px-5 text-sm font-semibold transition-colors',
                b.id === active ? 'text-ink' : 'text-petal-72 hover:text-petal',
              )}
            >
              {b.id === active && (
                <motion.span
                  layoutId="tab"
                  className="bg-plum absolute inset-0 rounded-full"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative">{b.name}</span>
            </button>
          ))}
        </div>
      </LayoutGroup>

      {board && board.rows.length === 0 ? (
        <EmptyState title="No scores yet." align="start">
          Scores appear here the moment the first round is played.
        </EmptyState>
      ) : (
        board && (
          <ol role="tabpanel" aria-label={board.name} className="border-petal-12 border-t">
            {board.rows.map((row) => (
              <motion.li
                key={row.key}
                layout
                transition={{ type: 'spring', stiffness: 300, damping: 34 }}
                className={cn(
                  'border-petal-12 grid grid-cols-[3rem_1fr_auto] items-center gap-4 border-b py-4 sm:grid-cols-[4rem_1fr_auto]',
                  row.rank <= 3 && 'py-5',
                )}
              >
                <span
                  className={cn(
                    'font-display tabular font-black',
                    row.rank === 1
                      ? 'text-plum text-4xl'
                      : row.rank <= 3
                        ? 'text-petal text-3xl'
                        : 'text-petal-50 text-xl',
                  )}
                >
                  {row.rank}
                </span>
                <span className="flex min-w-0 items-baseline gap-3">
                  <span
                    className={cn(
                      'text-petal truncate font-mono font-bold',
                      row.rank <= 3 ? 'text-xl' : 'text-lg',
                    )}
                  >
                    {row.label}
                  </span>
                  <span className="text-petal-72 text-sm">{row.sub}</span>
                </span>
                <span
                  className={cn(
                    'tabular font-mono font-bold',
                    row.rank <= 3 ? 'text-petal text-2xl' : 'text-petal-72 text-lg',
                  )}
                >
                  <AnimatedNumber value={row.score} />
                </span>
              </motion.li>
            ))}
          </ol>
        )
      )}
    </div>
  );
}
