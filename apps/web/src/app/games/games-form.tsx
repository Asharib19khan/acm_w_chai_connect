'use client';

import { motion } from 'motion/react';
import { useState, useTransition } from 'react';
import type { GameCategory } from '@chai/core';
import { Button, ButtonLink, Field, Input, cn } from '@chai/ui';
import { IdentityFields } from '@/components/identity-fields';
import { lookupAction, registerAction } from './actions';

export interface GameCard {
  id: string;
  name: string;
  category: GameCategory;
  blurb: string;
  teamSize: number;
  status: string;
  spotsLeft: number | null;
}

type Done = {
  confirmationCode: string;
  passCode: string;
  games: { name: string; status: string }[];
};

export function GamesForm({ games }: { games: GameCard[] }) {
  const [physical, setPhysical] = useState<string | null>(null);
  const [mini, setMini] = useState<string | null>(null);
  const [rollNo, setRollNo] = useState('');
  const [department, setDepartment] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setFormError(null);
      const result = await registerAction({
        rollNo,
        department,
        physical: physical ?? undefined,
        mini: mini ?? undefined,
      });
      if (result.ok) {
        setDone(result.data);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setErrors(result.fields ?? {});
        setFormError(result.message === 'Check the form.' ? null : result.message);
      }
    });

  if (done) return <Confirmation done={done} rollNo={rollNo} />;

  return (
    <form
      className="flex flex-col gap-12"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <GameGroup
        title="Physical games"
        hint="Pick one, or none."
        games={games.filter((g) => g.category === 'physical')}
        value={physical}
        onChange={setPhysical}
      />
      <GameGroup
        title="Minigames"
        hint="Pick one, or none."
        games={games.filter((g) => g.category === 'mini')}
        value={mini}
        onChange={setMini}
      />
      {errors.physical && (
        <p className="text-danger -mt-8 text-sm font-medium" role="alert">
          {errors.physical}
        </p>
      )}

      <div className="border-line flex flex-col gap-6 border-t pt-8">
        <IdentityFields
          rollNo={rollNo}
          department={department}
          onRollNo={setRollNo}
          onDepartment={setDepartment}
          errors={errors}
        />
        {formError && (
          <p role="alert" className="text-danger text-sm font-medium">
            {formError}
          </p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-fg-muted text-sm">
            Each student can join one physical game and one minigame.
          </p>
          <Button type="submit" size="lg" loading={pending} disabled={!physical && !mini}>
            Register
          </Button>
        </div>
      </div>
    </form>
  );
}

function GameGroup({
  title,
  hint,
  games,
  value,
  onChange,
}: {
  title: string;
  hint: string;
  games: GameCard[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <fieldset>
      <legend className="flex w-full items-baseline justify-between gap-4 pb-4">
        <span className="font-display text-fg text-2xl font-bold">{title}</span>
        <span className="text-fg-muted text-sm">{hint}</span>
      </legend>
      <div role="radiogroup" aria-label={title} className="border-line border-t">
        {games.map((game) => {
          const selected = value === game.id;
          const closed = game.status !== 'open';
          return (
            <button
              key={game.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={closed}
              onClick={() => onChange(selected ? null : game.id)}
              className={cn(
                'group border-line relative flex w-full items-start gap-4 border-b py-5 text-left transition-colors disabled:opacity-50',
                !closed && 'hover:bg-wash',
              )}
            >
              {selected && (
                <motion.span
                  layoutId={`pick-${games[0]?.category}`}
                  className="bg-accent-soft absolute inset-0 -z-0"
                  transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                />
              )}
              <span
                className={cn(
                  'relative mt-1 grid size-6 shrink-0 place-items-center rounded-full ring-2 transition-colors ring-inset',
                  selected
                    ? 'bg-accent ring-accent-strong'
                    : 'ring-edge group-hover:ring-fg-subtle',
                )}
                aria-hidden
              >
                {selected && <span className="bg-canvas size-2.5 rounded-full" />}
              </span>
              <span className="relative flex min-w-0 flex-1 flex-col gap-1 pr-2">
                <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-display text-fg text-xl font-semibold">{game.name}</span>
                  <span className="text-fg-muted text-xs font-medium">
                    {game.teamSize > 1 ? `Teams of ${game.teamSize}` : 'Solo'}
                    {' · '}
                    {closed
                      ? 'Closed'
                      : game.spotsLeft == null
                        ? 'Open to all'
                        : game.spotsLeft === 0
                          ? 'Full, waitlist open'
                          : `${game.spotsLeft} spots left`}
                  </span>
                </span>
                <span className="text-fg-muted text-[0.95rem] leading-snug">{game.blurb}</span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Confirmation({ done, rollNo }: { done: Done; rollNo: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-8"
    >
      <div className="bg-accent text-fg overflow-hidden rounded-[28px]">
        <div className="flex flex-col gap-1 p-6 sm:p-8">
          <span className="text-sm font-semibold">You’re in</span>
          <span className="font-display text-3xl font-black tracking-tight sm:text-4xl">
            {done.games.map((g) => g.name).join(' + ')}
          </span>
          {done.games.some((g) => g.status === 'waitlisted') && (
            <span className="mt-1 text-sm font-medium">
              Some games are full, so you’re on the waitlist there. The desk will call you.
            </span>
          )}
        </div>
        <div className="border-fg/25 grid grid-cols-2 border-t-2 border-dashed">
          <div className="flex flex-col gap-1 p-6 sm:p-8">
            <span className="text-xs font-semibold">Confirmation</span>
            <span className="font-mono text-xl font-bold tracking-wider whitespace-nowrap sm:text-2xl">
              {done.confirmationCode}
            </span>
          </div>
          <div className="border-fg/25 flex flex-col gap-1 border-l-2 border-dashed p-6 sm:p-8">
            <span className="text-xs font-semibold">Pass code</span>
            <span className="font-mono text-xl font-bold tracking-[0.2em] whitespace-nowrap sm:text-2xl">
              {done.passCode}
            </span>
          </div>
        </div>
      </div>
      <p className="text-fg-muted max-w-md">
        <strong className="text-fg">Screenshot this.</strong> You need your roll number{' '}
        <span className="text-fg font-mono">{rollNo}</span> and the pass code to play. It is shown
        only once; the desk can reset it if you lose it.
      </p>
      <ButtonLink href="/" variant="secondary" className="self-start">
        Back home
      </ButtonLink>
    </motion.div>
  );
}

export function LookupForm() {
  const [rollNo, setRollNo] = useState('');
  const [code, setCode] = useState('');
  const [rows, setRows] = useState<
    { game: string; status: string; team: string | null; round: number | null }[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const result = await lookupAction(rollNo, code);
          if (result.ok) {
            setRows(result.data);
            setError(null);
          } else {
            setRows(null);
            setError(result.message);
          }
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Roll number">
          {({ id }) => (
            <Input
              id={id}
              value={rollNo}
              onChange={(e) => setRollNo(e.target.value.toUpperCase())}
              placeholder="25K-5570"
              className="font-mono"
            />
          )}
        </Field>
        <Field label="Confirmation code">
          {({ id }) => (
            <Input
              id={id}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="CC-7F3K2"
              className="font-mono"
            />
          )}
        </Field>
        <Button type="submit" variant="secondary" size="lg" loading={pending}>
          Check
        </Button>
      </div>
      {error && (
        <p className="text-danger text-sm font-medium" role="alert">
          {error}
        </p>
      )}
      {rows && (
        <ul className="border-line border-t">
          {rows.map((r) => (
            <li
              key={r.game}
              className="border-line flex items-center justify-between border-b py-3"
            >
              <span className="text-fg font-semibold">{r.game}</span>
              <span className="text-fg-muted text-sm">
                {r.status.replace('_', ' ')}
                {r.round ? ` · round ${r.round}` : ''}
                {r.team ? ` · ${r.team}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
