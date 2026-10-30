'use client';

import { AnimatePresence, Reorder, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import type { Quiz, QuizPhase, QuizQuestion, QuizSettings } from '@chai/db';
import { Button, EmptyState, Field, Input, Switch, Textarea, cn, useToast } from '@chai/ui';
import { quizControlAction } from '@/app/presenter-actions';
import {
  createQuizAction,
  deleteQuestionAction,
  deleteQuizAction,
  importAction,
  reinstateAction,
  reorderAction,
  saveQuestionAction,
  updateQuizAction,
} from '../actions';

interface Props {
  quizzes: Quiz[];
  control: { phase: QuizPhase; quizId: string | null; title: string | null };
  joined: number;
  disqualified: { id: string; rollNo: string; reason: string; answered: number }[];
}

export function QuizEditor({ quizzes, control, joined, disqualified }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [activeId, setActiveId] = useState(control.quizId ?? quizzes[0]?.id ?? null);
  const [newTitle, setNewTitle] = useState('');
  const [pending, start] = useTransition();
  const quiz = quizzes.find((q) => q.id === activeId) ?? quizzes[0];
  const locked = Boolean(
    quiz && control.quizId === quiz.id && ['open', 'countdown', 'live'].includes(control.phase),
  );

  useEffect(() => {
    if (control.phase === 'locked') return;
    const id = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(id);
  }, [control.phase, router]);

  const run = <T,>(
    fn: () => Promise<{ ok: true; data: T } | { ok: false; message: string }>,
    done?: string,
    after?: (d: T) => void,
  ) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        if (done) toast(done, 'success');
        after?.(r.data);
        router.refresh();
      } else toast(r.message, 'error');
    });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-fg text-4xl font-black tracking-tight">Quiz</h1>
          <p className="text-fg-muted mt-1 text-sm">
            Build quizzes here; unlock and start them here or from the display.
          </p>
        </div>
      </div>

      <LiveControl
        control={control}
        joined={joined}
        quizzes={quizzes}
        disqualified={disqualified}
        activeId={quiz?.id ?? null}
      />

      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="flex flex-col gap-3">
          <ul className="flex flex-col gap-1">
            {quizzes.map((q) => (
              <li key={q.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(q.id)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left ring-1 transition-colors',
                    q.id === quiz?.id
                      ? 'bg-surface-2 ring-accent-strong'
                      : 'bg-surface ring-edge hover:ring-fg-subtle',
                  )}
                >
                  <span className="min-w-0">
                    <span className="text-fg block truncate font-semibold">{q.title}</span>
                    <span className="text-fg-muted text-xs">
                      {q.questions.length} questions{q.ranAt ? ' · has run' : ''}
                    </span>
                  </span>
                  {control.quizId === q.id && control.phase !== 'locked' && (
                    <span className="bg-accent text-fg rounded-full px-2 py-0.5 text-xs font-bold capitalize">
                      {control.phase}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () => createQuizAction(newTitle || 'New quiz'),
                'Quiz created.',
                (d) => {
                  setActiveId(d.id);
                  setNewTitle('');
                },
              );
            }}
          >
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="New quiz title"
              aria-label="New quiz title"
              className="h-11 text-sm"
            />
            <Button type="submit" size="md" loading={pending}>
              Add
            </Button>
          </form>
        </aside>

        {quiz ? (
          <QuizBody
            key={`${quiz.id}:${quiz.questions.map((q) => q.id).join()}`}
            quiz={quiz}
            locked={locked}
            run={run}
            pending={pending}
          />
        ) : (
          <div className="bg-surface ring-edge rounded-[24px] ring-1">
            <EmptyState title="No quizzes yet.">
              Create one on the left, then add questions or paste a CSV.
            </EmptyState>
          </div>
        )}
      </div>
    </div>
  );
}

type Runner = <T>(
  fn: () => Promise<{ ok: true; data: T } | { ok: false; message: string }>,
  done?: string,
  after?: (d: T) => void,
) => void;

function QuizBody({
  quiz,
  locked,
  run,
  pending,
}: {
  quiz: Quiz;
  locked: boolean;
  run: Runner;
  pending: boolean;
}) {
  const [title, setTitle] = useState(quiz.title);
  const [order, setOrder] = useState(quiz.questions.map((q) => q.id));
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [importing, setImporting] = useState(false);

  const setting = (patch: Partial<QuizSettings>) =>
    run(() => updateQuizAction(quiz.id, { settings: patch }));
  const byId = new Map(quiz.questions.map((q) => [q.id, q]));

  return (
    <section className="flex flex-col gap-6">
      {locked && (
        <p className="bg-accent-soft text-fg ring-accent-strong/40 rounded-2xl px-4 py-3 text-sm font-semibold ring-1">
          This quiz is open or live, so questions are read-only. Lock it to edit.
        </p>
      )}

      <div className="bg-surface ring-edge flex flex-col gap-5 rounded-[24px] p-6 ring-1">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Title" className="min-w-0 flex-1">
            {({ id }) => (
              <Input
                id={id}
                value={title}
                disabled={locked}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() =>
                  title !== quiz.title &&
                  run(() => updateQuizAction(quiz.id, { title }), 'Title saved.')
                }
              />
            )}
          </Field>
          <Button
            variant="secondary"
            onClick={() =>
              run(() => createQuizAction(`${quiz.title} (copy)`, quiz.id), 'Duplicated.')
            }
          >
            Duplicate
          </Button>
          {!quiz.ranAt && (
            <Button
              variant="ghost"
              disabled={locked}
              onClick={() =>
                window.confirm(`Delete “${quiz.title}”?`) &&
                run(() => deleteQuizAction(quiz.id), 'Deleted.')
              }
            >
              Delete
            </Button>
          )}
          {quiz.ranAt && (
            <a
              href={`/admin/quiz/export?quiz=${quiz.id}`}
              className="text-accent-strong ring-edge hover:ring-accent-strong inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold ring-1"
            >
              Export results
            </a>
          )}
        </div>
        <div className="border-line grid gap-5 border-t pt-5 md:grid-cols-2">
          <Switch
            checked={quiz.settings.shuffleQuestions}
            disabled={locked}
            onChange={(v) => setting({ shuffleQuestions: v })}
            label="Shuffle questions"
            description="Each student gets their own order."
          />
          <Switch
            checked={quiz.settings.shuffleOptions}
            disabled={locked}
            onChange={(v) => setting({ shuffleOptions: v })}
            label="Shuffle options"
          />
          <Switch
            checked={quiz.settings.dqOnLeave}
            disabled={locked}
            onChange={(v) => setting({ dqOnLeave: v })}
            label="Disqualify on leaving the tab"
          />
          <Switch
            checked={quiz.settings.revealAfterEnd}
            disabled={locked}
            onChange={(v) => setting({ revealAfterEnd: v })}
            label="Reveal answers after the end"
          />
          <Field label="Offline limit (seconds, 0 turns it off)">
            {({ id }) => (
              <Input
                id={id}
                type="number"
                min={0}
                max={120}
                disabled={locked}
                defaultValue={quiz.settings.offlineSeconds}
                onBlur={(e) =>
                  setting({
                    offlineSeconds: Math.max(0, Math.min(120, Number(e.target.value) || 0)),
                  })
                }
                className="font-mono"
              />
            )}
          </Field>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-display text-fg text-2xl font-bold">
          {quiz.questions.length} questions
        </h2>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={locked}
            onClick={() => setImporting(!importing)}
          >
            Import CSV / JSON
          </Button>
          <Button size="sm" disabled={locked} onClick={() => setEditing('new')}>
            Add question
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {importing && <ImportBox quizId={quiz.id} run={run} onDone={() => setImporting(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {editing === 'new' && (
          <QuestionForm
            key="new"
            quizId={quiz.id}
            run={run}
            pending={pending}
            onClose={() => setEditing(null)}
          />
        )}
      </AnimatePresence>

      {quiz.questions.length === 0 && editing !== 'new' ? (
        <div className="bg-surface ring-edge rounded-[24px] ring-1">
          <EmptyState title="No questions yet.">
            Add one, or paste a CSV: question, options…, correct number, seconds.
          </EmptyState>
        </div>
      ) : (
        <Reorder.Group
          axis="y"
          values={order}
          onReorder={setOrder}
          className="flex flex-col gap-2"
          onPointerUp={() =>
            order.join() !== quiz.questions.map((q) => q.id).join() &&
            run(() => reorderAction(quiz.id, order))
          }
        >
          {order.map((id, i) => {
            const q = byId.get(id);
            if (!q) return null;
            return (
              <Reorder.Item
                key={id}
                value={id}
                dragListener={!locked && editing === null}
                className="list-none"
              >
                {editing === id ? (
                  <QuestionForm
                    quizId={quiz.id}
                    question={q}
                    run={run}
                    pending={pending}
                    onClose={() => setEditing(null)}
                  />
                ) : (
                  <div className="bg-surface ring-edge flex items-start gap-4 rounded-2xl p-4 ring-1">
                    <span
                      className={cn(
                        'text-fg-subtle mt-0.5 font-mono text-sm',
                        !locked && 'cursor-grab active:cursor-grabbing',
                      )}
                      aria-hidden
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <p className="text-fg font-semibold">{q.body}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {q.options.map((o) => (
                          <span
                            key={o.id}
                            className={cn(
                              'rounded-full px-2.5 py-0.5 text-xs ring-1',
                              o.id === q.correctOptionId
                                ? 'text-ok ring-ok/50 font-bold'
                                : 'text-fg-muted ring-edge',
                            )}
                          >
                            {o.text}
                          </span>
                        ))}
                      </div>
                      <p className="text-fg-subtle font-mono text-xs">
                        {q.timeLimitS}s · {q.points} pts
                      </p>
                    </div>
                    {!locked && (
                      <div className="flex shrink-0 gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(id)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            window.confirm('Delete this question?') &&
                            run(() => deleteQuestionAction(quiz.id, id), 'Deleted.')
                          }
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
      )}
    </section>
  );
}

function QuestionForm({
  quizId,
  question,
  run,
  pending,
  onClose,
}: {
  quizId: string;
  question?: QuizQuestion;
  run: Runner;
  pending: boolean;
  onClose: () => void;
}) {
  const [body, setBody] = useState(question?.body ?? '');
  const [options, setOptions] = useState(
    question?.options ?? [
      { id: 'o0', text: '' },
      { id: 'o1', text: '' },
      { id: 'o2', text: '' },
      { id: 'o3', text: '' },
    ],
  );
  const [correct, setCorrect] = useState(question?.correctOptionId ?? 'o0');
  const [time, setTime] = useState(question?.timeLimitS ?? 15);
  const [points, setPoints] = useState(question?.points ?? 1000);
  const nextId = () => `o${Math.max(-1, ...options.map((o) => Number(o.id.slice(1)) || 0)) + 1}`;
  return (
    <motion.form
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            saveQuestionAction(
              quizId,
              { body, options, correctOptionId: correct, timeLimitS: time, points },
              question?.id,
            ),
          'Question saved.',
          onClose,
        );
      }}
      className="bg-surface-2 ring-accent-strong grid gap-6 rounded-[24px] p-6 ring-1 lg:grid-cols-[minmax(0,1fr)_15rem]"
    >
      <div className="flex flex-col gap-4">
        <Field label="Question">
          {({ id }) => (
            <Textarea
              id={id}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={200}
              className="min-h-24"
              autoFocus
            />
          )}
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-fg mb-2 text-sm font-semibold">
            Options (tap the circle for the correct one)
          </legend>
          {options.map((o, i) => (
            <div key={o.id} className="flex items-center gap-2">
              <button
                type="button"
                role="radio"
                aria-checked={correct === o.id}
                aria-label={`Mark option ${i + 1} correct`}
                onClick={() => setCorrect(o.id)}
                className={cn(
                  'grid size-7 shrink-0 place-items-center rounded-full ring-2 ring-inset',
                  correct === o.id ? 'bg-ok-soft ring-ok' : 'ring-edge hover:ring-fg-subtle',
                )}
              >
                {correct === o.id && <span className="bg-canvas size-2.5 rounded-full" />}
              </button>
              <Input
                value={o.text}
                onChange={(e) =>
                  setOptions(
                    options.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)),
                  )
                }
                placeholder={`Option ${i + 1}`}
                maxLength={120}
                aria-label={`Option ${i + 1}`}
                className="h-11 text-sm"
              />
              {options.length > 2 && (
                <button
                  type="button"
                  aria-label={`Remove option ${i + 1}`}
                  onClick={() => setOptions(options.filter((x) => x.id !== o.id))}
                  className="text-fg-muted hover:text-danger grid size-9 shrink-0 place-items-center rounded-full"
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
              )}
            </div>
          ))}
          {options.length < 6 && (
            <Button
              size="sm"
              variant="ghost"
              className="self-start"
              onClick={() => setOptions([...options, { id: nextId(), text: '' }])}
            >
              Add option
            </Button>
          )}
        </fieldset>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Seconds (5–60)">
            {({ id }) => (
              <Input
                id={id}
                type="number"
                min={5}
                max={60}
                value={time}
                onChange={(e) => setTime(Number(e.target.value))}
                className="font-mono"
              />
            )}
          </Field>
          <Field label="Base points">
            {({ id }) => (
              <Input
                id={id}
                type="number"
                min={100}
                max={5000}
                step={100}
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
                className="font-mono"
              />
            )}
          </Field>
        </div>
        <div className="flex gap-2">
          <Button type="submit" loading={pending}>
            Save question
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
      <PhonePreview body={body} options={options.map((o) => o.text)} time={time} />
    </motion.form>
  );
}

function PhonePreview({ body, options, time }: { body: string; options: string[]; time: number }) {
  return (
    <div
      aria-label="Phone preview"
      className="bg-canvas ring-edge mx-auto w-60 self-start rounded-[2.2rem] p-3 ring-1"
    >
      <div className="bg-surface flex flex-col gap-3 rounded-[1.6rem] p-4">
        <div className="text-fg-muted flex justify-between text-[10px]">
          <span>1 / 10</span>
          <span className="text-fg font-mono font-bold">{time}s</span>
        </div>
        <div className="bg-accent h-1 rounded-full" />
        <p className="font-display text-fg text-sm leading-snug font-bold">
          {body || 'Your question'}
        </p>
        {options.map((o, i) => (
          <div
            key={i}
            className="bg-surface-2 text-fg ring-edge rounded-xl px-3 py-2 text-xs font-semibold ring-1"
          >
            {o || `Option ${i + 1}`}
          </div>
        ))}
      </div>
    </div>
  );
}

function ImportBox({ quizId, run, onDone }: { quizId: string; run: Runner; onDone: () => void }) {
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="bg-surface ring-edge flex flex-col gap-3 rounded-[24px] p-6 ring-1">
        <p className="text-fg-muted text-sm">
          One question per line:{' '}
          <span className="text-fg font-mono">
            question, option 1, option 2, …, correct number, seconds
          </span>
          . Or paste a JSON array. Nothing is saved until every row is valid.
        </p>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="font-mono text-sm"
          placeholder="What is 2+2?, 3, 4, 5, 2, 15"
          aria-label="Questions to import"
        />
        {errors.length > 0 && (
          <ul className="text-danger flex flex-col gap-1 text-sm" role="alert">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Button
            onClick={() =>
              run(
                () => importAction(quizId, text),
                undefined,
                (d) => {
                  if ('errors' in d) setErrors(d.errors);
                  else {
                    setErrors([]);
                    setText('');
                    onDone();
                  }
                },
              )
            }
          >
            Validate and import
          </Button>
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function LiveControl({
  control,
  joined,
  quizzes,
  disqualified,
  activeId,
}: {
  control: Props['control'];
  joined: number;
  quizzes: Quiz[];
  disqualified: Props['disqualified'];
  activeId: string | null;
}) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const act = (action: 'unlock' | 'start' | 'end' | 'lock', quizId?: string) =>
    start(async () => {
      const r = await quizControlAction(action, quizId);
      if (!r.ok) toast(r.message, 'error');
      router.refresh();
    });
  const target = quizzes.find((q) => q.id === activeId);
  const live = control.phase !== 'locked';
  return (
    <section
      className={cn(
        'flex flex-col gap-4 rounded-[24px] p-6 ring-1',
        live ? 'bg-accent text-fg ring-accent-strong' : 'bg-surface text-fg ring-edge',
      )}
      aria-label="Live control"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className={cn('text-sm font-semibold', live ? 'text-fg/70' : 'text-fg-muted')}>
            Live control
          </p>
          <p className="font-display text-2xl font-bold capitalize">
            {control.phase}
            {control.title ? ` · ${control.title}` : ''}
            {live && <span className="ml-3 font-mono text-lg">{joined} joined</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {control.phase === 'locked' && (
            <Button
              loading={pending}
              disabled={!target || target.questions.length === 0}
              onClick={() => act('unlock', target?.id)}
            >
              Unlock “{target?.title ?? 'quiz'}”
            </Button>
          )}
          {control.phase === 'open' && (
            <>
              <Button
                className="bg-canvas text-accent-strong hover:bg-surface"
                loading={pending}
                onClick={() => act('start')}
              >
                Start: 5-second countdown
              </Button>
              <Button
                variant="ghost"
                className="text-fg hover:bg-canvas/10"
                onClick={() => act('lock')}
              >
                Lock again
              </Button>
            </>
          )}
          {(control.phase === 'live' || control.phase === 'countdown') && (
            <Button
              className="bg-canvas text-danger hover:bg-surface"
              loading={pending}
              onClick={() => act('end')}
            >
              End quiz now
            </Button>
          )}
          {control.phase === 'ended' && (
            <Button
              className="bg-canvas text-accent-strong hover:bg-surface"
              loading={pending}
              onClick={() => act('lock')}
            >
              Lock and reset
            </Button>
          )}
        </div>
      </div>
      {disqualified.length > 0 && (
        <div
          className={cn('flex flex-col gap-2 border-t pt-4', live ? 'border-fg/15' : 'border-line')}
        >
          <p className="text-sm font-semibold">Disqualified ({disqualified.length})</p>
          <ul className="flex flex-col gap-1.5">
            {disqualified.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  <span className="font-mono font-bold">{d.rollNo}</span> · {d.reason} ·{' '}
                  {d.answered} answered
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    start(async () => {
                      const r = await reinstateAction(d.id);
                      if (!r.ok) toast(r.message, 'error');
                      router.refresh();
                    })
                  }
                >
                  Reinstate
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
