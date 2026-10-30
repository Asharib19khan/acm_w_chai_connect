'use client';

import { motion } from 'motion/react';
import { useState, useTransition } from 'react';
import type { DisplayData } from '@chai/db';
import { Button, cn, useToast } from '@chai/ui';
import { quizControlAction, spotlightAction } from '@/app/presenter-actions';

interface Props {
  data: DisplayData;
  quizzes: { id: string; title: string; count: number }[];
  name: string;
  rotate: boolean;
  onRotate: (v: boolean) => void;
  spotlightId: string | null;
}

/** Presenter controls: only rendered for a signed-in admin. The server re-checks every action. */
export function PresenterBar({ data, quizzes, name, rotate, onRotate, spotlightId }: Props) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [quizId, setQuizId] = useState(quizzes.find((q) => q.count > 0)?.id ?? '');
  const [hidden, setHidden] = useState(false);
  const phase = data.quiz.phase;

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast(r.message ?? 'That did not work.', 'error');
    });

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: hidden ? 'calc(100% - 0.6rem)' : 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="bg-surface/95 text-fg ring-edge fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full p-2 pl-5 text-sm shadow-[0_20px_60px_-20px_var(--cc-shadow)] ring-1 backdrop-blur-md"
      role="toolbar"
      aria-label="Presenter controls"
    >
      <button
        type="button"
        className="text-fg-muted hover:text-fg font-semibold"
        onClick={() => setHidden(!hidden)}
        aria-expanded={!hidden}
      >
        {name}
      </button>
      <span className="bg-edge h-6 w-px" aria-hidden />
      {phase === 'locked' && (
        <>
          <select
            value={quizId}
            onChange={(e) => setQuizId(e.target.value)}
            aria-label="Quiz to unlock"
            className="bg-surface text-fg ring-edge focus:ring-accent-strong h-9 max-w-52 rounded-full px-3 ring-1 focus:outline-none"
          >
            {quizzes.length === 0 && <option value="">No quizzes yet</option>}
            {quizzes.map((q) => (
              <option key={q.id} value={q.id}>
                {q.title} ({q.count})
              </option>
            ))}
          </select>
          <Button
            size="sm"
            loading={pending}
            disabled={!quizId}
            onClick={() => run(() => quizControlAction('unlock', quizId))}
          >
            Unlock quiz
          </Button>
        </>
      )}
      {phase === 'open' && (
        <>
          <Button size="sm" loading={pending} onClick={() => run(() => quizControlAction('start'))}>
            Start · {data.quiz.joined} in
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => run(() => quizControlAction('lock'))}
          >
            Lock
          </Button>
        </>
      )}
      {(phase === 'live' || phase === 'countdown') && (
        <Button
          size="sm"
          variant="danger"
          loading={pending}
          onClick={() => run(() => quizControlAction('end'))}
        >
          End quiz now
        </Button>
      )}
      {phase === 'ended' && (
        <Button
          size="sm"
          variant="secondary"
          loading={pending}
          onClick={() => run(() => quizControlAction('lock'))}
        >
          Lock and reset
        </Button>
      )}
      {spotlightId && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => run(() => spotlightAction(spotlightId, false))}
        >
          Close spotlight
        </Button>
      )}
      <span className="bg-edge h-6 w-px" aria-hidden />
      <button
        type="button"
        onClick={() => onRotate(!rotate)}
        aria-pressed={rotate}
        className={cn(
          'h-9 rounded-full px-3 font-semibold ring-1',
          rotate ? 'text-fg ring-edge' : 'text-fg-subtle ring-edge/50',
        )}
      >
        Idle rotation {rotate ? 'on' : 'off'}
      </button>
      <a
        href="/admin"
        className="text-accent-strong hover:text-fg h-9 rounded-full px-3 leading-9 font-semibold"
      >
        Admin
      </a>
    </motion.div>
  );
}
