'use client';

import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { DEPARTMENTS, batchFromRollNumber } from '@chai/core';
import type {
  GameWithCounts,
  LeaderRow,
  PublicStation,
  RegistrationRow,
  RegistrationStatus,
  ScoreEvent,
} from '@chai/db';
import { AnimatedNumber, Button, Drawer, EmptyState, Input, Select, cn, useToast } from '@chai/ui';
import {
  autoAssignAction,
  gameStatusAction,
  historyAction,
  registrationAction,
  scoreAction,
  voidAction,
} from './actions';
import { StationPanel } from './stations';

interface Props {
  games: GameWithCounts[];
  registrations: RegistrationRow[];
  boards: Record<string, LeaderRow[]>;
  stations: PublicStation[];
}

const STATUSES: { id: RegistrationStatus; label: string }[] = [
  { id: 'registered', label: 'Registered' },
  { id: 'waitlisted', label: 'Waitlisted' },
  { id: 'checked_in', label: 'Checked in' },
  { id: 'withdrawn', label: 'Withdrawn' },
  { id: 'disqualified', label: 'Disqualified' },
];

const STATUS_TONE: Record<RegistrationStatus, string> = {
  registered: 'text-fg ring-edge',
  waitlisted: 'text-fg-muted ring-edge/60',
  checked_in: 'text-fg bg-accent ring-accent-strong',
  withdrawn: 'text-fg-subtle ring-edge/40',
  disqualified: 'text-danger ring-danger/50',
};

/** Games that talk to the desk with a station key: minigame laptops, and Hide & Seek's game server. */
const hasStation = (g: GameWithCounts | null | undefined) =>
  Boolean(g && (g.category === 'mini' || g.slug === 'hide-and-seek'));

export function RegistrationsPortal({ games, registrations, boards, stations }: Props) {
  const router = useRouter();
  const [gameId, setGameId] = useState<string | 'all'>('all');
  const [chosenView, setView] = useState<'applicants' | 'groups' | 'scores' | 'station'>(
    'applicants',
  );
  const [query, setQuery] = useState('');
  const [dept, setDept] = useState('');
  const [batch, setBatch] = useState('');
  const [statuses, setStatuses] = useState<Set<RegistrationStatus>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(id);
  }, [router]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target as HTMLElement).closest('input,textarea,select')) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const game = games.find((g) => g.id === gameId);
  // Only minigames run on a game station; other games fall back to the applicants list.
  const view = chosenView === 'station' && !hasStation(game) ? 'applicants' : chosenView;
  const batches = useMemo(
    () => [...new Set(registrations.map((r) => batchFromRollNumber(r.rollNo)))].sort(),
    [registrations],
  );

  const rows = useMemo(() => {
    const q = query.trim().toUpperCase();
    return registrations.filter(
      (r) =>
        (gameId === 'all' || r.gameId === gameId) &&
        (!q ||
          r.rollNo.includes(q) ||
          r.rollNo.replace('-', '').includes(q) ||
          r.confirmationCode.includes(q)) &&
        (!dept || r.department === dept) &&
        (!batch || String(batchFromRollNumber(r.rollNo)) === batch) &&
        (statuses.size === 0 || statuses.has(r.status)),
    );
  }, [registrations, gameId, query, dept, batch, statuses]);

  const open = registrations.find((r) => r.id === openId) ?? null;
  const totals = {
    registered: registrations.filter((r) => r.status === 'registered' || r.status === 'checked_in')
      .length,
    checkedIn: registrations.filter((r) => r.status === 'checked_in').length,
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="flex flex-col gap-1 lg:sticky lg:top-24 lg:self-start" aria-label="Games">
        <LayoutGroup>
          <RailButton
            active={gameId === 'all'}
            onClick={() => setGameId('all')}
            label="All games"
            sub={`${totals.registered} in · ${totals.checkedIn} checked in`}
          />
          {(['physical', 'mini'] as const).map((cat) => (
            <div key={cat} className="mt-4 flex flex-col gap-1">
              <p className="text-fg-subtle px-3 text-xs font-semibold">
                {cat === 'physical' ? 'Physical' : 'Minigames'}
              </p>
              {games
                .filter((g) => g.category === cat)
                .map((g) => (
                  <RailButton
                    key={g.id}
                    active={gameId === g.id}
                    onClick={() => setGameId(g.id)}
                    label={g.name}
                    sub={`${g.registered}${g.capacity ? `/${g.capacity}` : ''} in · ${g.checkedIn} checked in${g.waitlisted ? ` · ${g.waitlisted} waiting` : ''}`}
                    live={g.status === 'live'}
                  />
                ))}
            </div>
          ))}
        </LayoutGroup>
      </aside>

      <section className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-fg text-4xl font-black tracking-tight">
              {game?.name ?? 'All registrations'}
            </h1>
            <p className="text-fg-muted mt-1 text-sm">
              {game
                ? `${game.category === 'physical' ? 'Physical' : 'Minigame'} · ${game.teamSize > 1 ? `teams of ${game.teamSize}` : 'solo'} · ${game.status}`
                : `${registrations.length} registrations across ${games.length} games`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {game && <GameStatus game={game} />}
            <a
              href={`/export${game ? `?game=${game.id}` : ''}`}
              className="text-accent-strong ring-edge hover:ring-accent-strong inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold ring-1"
            >
              Export CSV
            </a>
          </div>
        </div>

        {game && (
          <LayoutGroup>
            <div role="tablist" className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              {(hasStation(game)
                ? (['applicants', 'groups', 'scores', 'station'] as const)
                : (['applicants', 'groups', 'scores'] as const)
              ).map((v) => (
                <button
                  key={v}
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  className={cn(
                    'relative h-10 shrink-0 rounded-full px-4 text-sm font-semibold whitespace-nowrap',
                    view === v ? 'text-fg' : 'text-fg-muted hover:text-fg',
                  )}
                >
                  {view === v && (
                    <motion.span
                      layoutId="reg-view"
                      className="bg-accent absolute inset-0 rounded-full"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className="relative">
                    {v === 'applicants'
                      ? 'Applicants'
                      : v === 'groups'
                        ? 'Teams & rounds'
                        : v === 'scores'
                          ? 'Scores'
                          : 'Game station'}
                  </span>
                </button>
              ))}
            </div>
          </LayoutGroup>
        )}

        {(!game || view === 'applicants') && (
          <>
            <div className="bg-surface ring-edge flex flex-col gap-3 rounded-[24px] p-4 ring-1">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_9rem]">
                <Input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Roll number or code. Press / to search"
                  aria-label="Search registrations"
                  className="h-11 font-mono text-sm"
                />
                <Select
                  value={dept}
                  onChange={(e) => setDept(e.target.value)}
                  aria-label="Department"
                  className="h-11 text-sm"
                >
                  <option value="">All departments</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.code}
                    </option>
                  ))}
                </Select>
                <Select
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                  aria-label="Batch"
                  className="h-11 text-sm"
                >
                  <option value="">All batches</option>
                  {batches.map((b) => (
                    <option key={b} value={b}>
                      Batch {b}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((s) => {
                  const on = statuses.has(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setStatuses((set) => {
                          const next = new Set(set);
                          if (on) next.delete(s.id);
                          else next.add(s.id);
                          return next;
                        })
                      }
                      className={cn(
                        'h-8 rounded-full px-3 text-xs font-semibold ring-1 transition-colors',
                        on
                          ? 'bg-accent text-fg ring-accent-strong'
                          : 'text-fg-muted ring-edge hover:text-fg',
                      )}
                    >
                      {s.label}
                    </button>
                  );
                })}
                <span className="text-fg-subtle ml-auto self-center font-mono text-xs">
                  {rows.length} shown
                </span>
              </div>
            </div>

            {rows.length === 0 ? (
              <div className="bg-surface ring-edge rounded-[24px] ring-1">
                <EmptyState
                  title={registrations.length === 0 ? 'No registrations yet.' : 'Nobody matches.'}
                >
                  {registrations.length === 0
                    ? 'Students register on the student site under “Join the games”.'
                    : 'Try fewer filters or a shorter search.'}
                </EmptyState>
              </div>
            ) : (
              <div className="bg-surface ring-edge overflow-hidden rounded-[24px] ring-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-line text-fg-subtle border-b text-left text-xs">
                      <th className="px-4 py-3 font-semibold">Roll number</th>
                      <th className="px-3 py-3 font-semibold">Dept</th>
                      {gameId === 'all' && (
                        <th className="hidden px-3 py-3 font-semibold md:table-cell">Game</th>
                      )}
                      <th className="px-3 py-3 font-semibold">Status</th>
                      <th className="hidden px-3 py-3 font-semibold sm:table-cell">Team / round</th>
                      <th className="hidden px-3 py-3 font-semibold lg:table-cell">Registered</th>
                      <th className="px-4 py-3 text-right font-semibold">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence initial={false}>
                      {rows.slice(0, 300).map((r) => (
                        <motion.tr
                          key={r.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={() => setOpenId(r.id)}
                          className="border-line hover:bg-wash cursor-pointer border-b transition-colors last:border-0"
                        >
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              className="text-fg font-mono font-bold"
                              onClick={() => setOpenId(r.id)}
                            >
                              {r.rollNo}
                            </button>
                          </td>
                          <td className="text-fg-muted px-3 py-3">{r.department}</td>
                          {gameId === 'all' && (
                            <td className="text-fg-muted hidden px-3 py-3 md:table-cell">
                              {r.gameName}
                            </td>
                          )}
                          <td className="px-3 py-3">
                            <span
                              className={cn(
                                'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1',
                                STATUS_TONE[r.status],
                              )}
                            >
                              {r.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="text-fg-muted hidden px-3 py-3 sm:table-cell">
                            {[r.team, r.round ? `R${r.round}` : null].filter(Boolean).join(' · ') ||
                              '—'}
                          </td>
                          <td className="text-fg-subtle hidden px-3 py-3 font-mono text-xs lg:table-cell">
                            {new Date(r.createdAt).toLocaleString('en-GB', {
                              timeZone: 'Asia/Karachi',
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </td>
                          <td className="text-fg tabular px-4 py-3 text-right font-mono font-bold">
                            {r.total}
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {game && view === 'groups' && (
          <Groups
            game={game}
            rows={registrations.filter((r) => r.gameId === game.id)}
            onOpen={setOpenId}
          />
        )}
        {game && view === 'scores' && <Scores rows={boards[game.id] ?? []} onOpen={setOpenId} />}
        {game && view === 'station' && (
          <StationPanel game={game} stations={stations.filter((st) => st.gameId === game.id)} />
        )}
      </section>

      <PlayerDrawer key={open?.id ?? 'none'} reg={open} onClose={() => setOpenId(null)} />
    </div>
  );
}

function RailButton({
  active,
  onClick,
  label,
  sub,
  live,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sub: string;
  live?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active || undefined}
      className={cn(
        'relative flex flex-col rounded-2xl px-3 py-2.5 text-left',
        active ? 'text-fg' : 'text-fg hover:bg-wash',
      )}
    >
      {active && (
        <motion.span
          layoutId="rail"
          className="bg-accent absolute inset-0 rounded-2xl"
          transition={{ type: 'spring', stiffness: 420, damping: 36 }}
        />
      )}
      <span className="relative flex items-center gap-2 font-semibold">
        {live && (
          <span
            className={cn('cc-live-dot size-2 rounded-full', active ? 'bg-canvas' : 'bg-accent')}
          />
        )}
        {label}
      </span>
      <span
        className={cn('relative font-mono text-[11px]', active ? 'text-fg/70' : 'text-fg-subtle')}
      >
        {sub}
      </span>
    </button>
  );
}

function GameStatus({ game }: { game: GameWithCounts }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Select
      value={game.status}
      disabled={pending}
      aria-label="Game status"
      className="h-9 rounded-full py-0 pr-9 pl-4 text-sm"
      onChange={(e) =>
        start(async () => {
          const r = await gameStatusAction(
            game.id,
            e.target.value as 'open' | 'closed' | 'live' | 'ended',
          );
          if (r.ok) router.refresh();
          else toast(r.message, 'error');
        })
      }
    >
      <option value="open">Registration open</option>
      <option value="closed">Registration closed</option>
      <option value="live">Live now</option>
      <option value="ended">Ended</option>
    </Select>
  );
}

function Groups({
  game,
  rows,
  onOpen,
}: {
  game: GameWithCounts;
  rows: RegistrationRow[];
  onOpen: (id: string) => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const [perRound, setPerRound] = useState(
    game.slug === 'hide-and-seek' ? 20 : 30,
  );
  const [pending, start] = useTransition();
  const checked = rows.filter((r) => r.status === 'checked_in');
  const key = game.teamSize > 1 ? 'team' : 'round';
  const groups = useMemo(() => {
    const map = new Map<string, RegistrationRow[]>();
    for (const r of checked) {
      const k =
        key === 'team' ? (r.team ?? 'Unassigned') : r.round ? `Round ${r.round}` : 'Unassigned';
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  }, [checked, key]);
  const assign = () =>
    start(async () => {
      const r = await autoAssignAction(game.id, key === 'team' ? 'teams' : 'rounds', perRound);
      if (r.ok) {
        toast(`Assigned ${r.data} players.`, 'success');
        router.refresh();
      } else toast(r.message, 'error');
    });
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-surface ring-edge flex flex-wrap items-center gap-3 rounded-[24px] p-4 ring-1">
        <p className="text-fg-muted text-sm">
          {checked.length} checked in.{' '}
          {key === 'team'
            ? `Auto-build teams of ${game.teamSize}, mixed across departments.`
            : 'Split checked-in players into rounds.'}
        </p>
        {key === 'round' && (
          <label className="text-fg-muted flex items-center gap-2 text-sm">
            Per round
            <Input
              type="number"
              min={2}
              max={100}
              value={perRound}
              onChange={(e) => setPerRound(Number(e.target.value))}
              className="h-9 w-20 font-mono text-sm"
            />
          </label>
        )}
        <Button size="sm" loading={pending} onClick={assign} className="ml-auto">
          Auto-assign
        </Button>
        <Button size="sm" variant="secondary" onClick={() => window.print()}>
          Print rosters
        </Button>
      </div>
      {groups.length === 0 ? (
        <div className="bg-surface ring-edge rounded-[24px] ring-1">
          <EmptyState title="Nobody checked in yet.">
            Check players in from the Applicants tab, then auto-assign.
          </EmptyState>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map(([name, members]) => (
            <motion.div
              layout
              key={name}
              className="bg-surface ring-edge flex flex-col gap-2 rounded-[24px] p-5 ring-1"
            >
              <p className="flex items-baseline justify-between">
                <span className="font-display text-fg text-lg font-bold">{name}</span>
                <span className="text-fg-subtle font-mono text-xs">{members.length}</span>
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {members.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(m.id)}
                      className="text-fg ring-edge hover:ring-accent-strong rounded-full px-2.5 py-1 font-mono text-xs ring-1"
                    >
                      {m.rollNo} <span className="text-fg-subtle">{m.department}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function Scores({ rows, onOpen }: { rows: LeaderRow[]; onOpen: (id: string) => void }) {
  if (rows.length === 0)
    return (
      <div className="bg-surface ring-edge rounded-[24px] ring-1">
        <EmptyState title="No scores yet.">
          Open a player and use the + / − buttons to add points.
        </EmptyState>
      </div>
    );
  return (
    <ol className="bg-surface ring-edge overflow-hidden rounded-[24px] ring-1">
      {rows.map((r) => (
        <motion.li layout key={r.registrationId} className="border-line border-b last:border-0">
          <button
            type="button"
            onClick={() => onOpen(r.registrationId)}
            className="hover:bg-wash grid w-full grid-cols-[3rem_1fr_auto] items-center gap-3 px-5 py-3 text-left"
          >
            <span
              className={cn(
                'font-display text-xl font-black',
                r.rank === 1 ? 'text-accent-strong' : 'text-fg-subtle',
              )}
            >
              {r.rank}
            </span>
            <span className="text-fg font-mono font-bold">
              {r.team ?? r.rollNo}{' '}
              <span className="text-fg-muted font-sans text-xs font-normal">{r.department}</span>
            </span>
            <span className="text-fg tabular font-mono text-lg font-bold">
              <AnimatedNumber value={r.total} />
            </span>
          </button>
        </motion.li>
      ))}
    </ol>
  );
}

const PRESETS: [number, string][] = [
  [20, 'Catch'],
  [25, 'Survived'],
  [-30, 'Left the arena'],
];

function PlayerDrawer({ reg, onClose }: { reg: RegistrationRow | null; onClose: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [history, setHistory] = useState<ScoreEvent[]>([]);
  const [custom, setCustom] = useState('');
  const [reason, setReason] = useState('');
  const [team, setTeam] = useState(reg?.team ?? '');
  const [round, setRound] = useState(reg?.round ? String(reg.round) : '');
  const [newPass, setNewPass] = useState<string | null>(null);

  const load = (id: string) =>
    historyAction(id).then((r) => {
      if (r.ok) setHistory(r.data);
    });

  useEffect(() => {
    if (!reg) return;
    let alive = true;
    historyAction(reg.id).then((r) => {
      if (alive && r.ok) setHistory(r.data);
    });
    return () => {
      alive = false;
    };
  }, [reg?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!reg)
    return (
      <Drawer open={false} onClose={onClose} title="">
        {null}
      </Drawer>
    );

  const act = (action: Parameters<typeof registrationAction>[1], done: string) =>
    start(async () => {
      const r = await registrationAction(reg.id, action);
      if (r.ok) {
        if (r.data.passCode) setNewPass(r.data.passCode);
        toast(done, 'success');
        router.refresh();
      } else toast(r.message, 'error');
    });

  const score = (points: number, why: string) =>
    start(async () => {
      const r = await scoreAction(reg.id, points, why);
      if (r.ok) {
        toast(`${points > 0 ? '+' : ''}${points} · ${why}`, 'success');
        await load(reg.id);
        router.refresh();
      } else toast(r.message, 'error');
    });

  return (
    <Drawer
      open={Boolean(reg)}
      onClose={onClose}
      title={reg.rollNo}
      description={
        <span>
          {reg.gameName} · {reg.department} · batch {batchFromRollNumber(reg.rollNo)} ·{' '}
          <span className="font-mono">{reg.confirmationCode}</span>
          {reg.playClaimedAt && (
            <span className="text-fg mt-1 block font-semibold">
              Turn used at the game station,{' '}
              {new Date(reg.playClaimedAt).toLocaleTimeString('en-GB', {
                timeZone: 'Asia/Karachi',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </span>
      }
    >
      <div className="flex flex-col gap-7">
        <div className="flex items-end justify-between">
          <span
            className={cn(
              'inline-flex rounded-full px-3 py-1 text-sm font-semibold ring-1',
              STATUS_TONE[reg.status],
            )}
          >
            {reg.status.replace('_', ' ')}
          </span>
          <span className="text-right">
            <span className="text-fg-subtle block text-xs">Points</span>
            <span className="text-fg tabular font-mono text-4xl font-bold">
              <AnimatedNumber value={reg.total} />
            </span>
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {reg.status === 'registered' && (
            <Button loading={pending} onClick={() => act({ type: 'check_in' }, 'Checked in.')}>
              Check in
            </Button>
          )}
          {reg.status === 'checked_in' && (
            <Button
              variant="secondary"
              onClick={() => act({ type: 'undo_check_in' }, 'Check-in undone.')}
            >
              Undo check-in
            </Button>
          )}
          {reg.status === 'waitlisted' && (
            <Button onClick={() => act({ type: 'promote' }, 'Promoted from the waitlist.')}>
              Promote
            </Button>
          )}
          {reg.status !== 'withdrawn' && (
            <Button
              variant="secondary"
              onClick={() =>
                window.confirm(
                  `Withdraw ${reg.rollNo} from ${reg.gameName}? This frees the spot.`,
                ) && act({ type: 'withdraw' }, 'Withdrawn.')
              }
            >
              Withdraw
            </Button>
          )}
          {reg.status !== 'disqualified' && (
            <Button
              variant="ghost"
              onClick={() =>
                window.confirm('Disqualify this player?') &&
                act({ type: 'disqualify' }, 'Disqualified.')
              }
            >
              Disqualify
            </Button>
          )}
        </div>

        <section className="border-line flex flex-col gap-3 border-t pt-6">
          <h3 className="font-display text-fg font-bold">Score</h3>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(([points, why]) => (
              <button
                key={why}
                type="button"
                disabled={pending}
                onClick={() => score(points, why)}
                className={cn(
                  'h-10 rounded-full px-3.5 text-sm font-semibold ring-1 transition-colors disabled:opacity-50',
                  points > 0
                    ? 'text-fg ring-edge hover:bg-accent hover:text-fg hover:ring-accent-strong'
                    : 'text-danger ring-danger/40 hover:bg-danger-soft hover:text-fg',
                )}
              >
                {points > 0 ? '+' : ''}
                {points} {why}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number(custom);
              if (Number.isInteger(n) && n !== 0 && reason.trim().length >= 2) {
                score(n, reason.trim());
                setCustom('');
                setReason('');
              } else toast('Enter whole points and a reason.', 'error');
            }}
          >
            <div className="w-24 shrink-0">
              <Input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="±pts"
                aria-label="Custom points"
                className="h-11 font-mono text-sm"
                inputMode="numeric"
              />
            </div>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason"
              aria-label="Reason"
              className="h-11 text-sm"
            />
            <Button type="submit" variant="secondary">
              Add
            </Button>
          </form>
          {history.length > 0 && (
            <ul className="mt-2 flex flex-col">
              {history.map((e) => (
                <li
                  key={e.id}
                  className={cn(
                    'border-line flex items-center justify-between gap-3 border-t py-2 text-sm',
                    e.voided && 'opacity-50',
                  )}
                >
                  <span className={cn(e.voided && 'line-through')}>
                    <span
                      className={cn(
                        'font-mono font-bold',
                        e.points > 0 ? 'text-fg' : 'text-danger',
                      )}
                    >
                      {e.points > 0 ? '+' : ''}
                      {e.points}
                    </span>{' '}
                    <span className="text-fg-muted">{e.reason}</span>
                  </span>
                  {!e.voided ? (
                    <button
                      type="button"
                      className="text-fg-subtle hover:text-danger text-xs font-semibold"
                      onClick={() => {
                        const why = window.prompt('Why void this entry?');
                        if (why)
                          start(async () => {
                            const r = await voidAction(e.id, why);
                            if (r.ok) {
                              await load(reg.id);
                              router.refresh();
                            } else toast(r.message, 'error');
                          });
                      }}
                    >
                      Void
                    </button>
                  ) : (
                    <span className="text-fg-subtle text-xs">voided: {e.voidReason}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border-line grid grid-cols-2 gap-3 border-t pt-6">
          <h3 className="font-display text-fg col-span-2 font-bold">Team & round</h3>
          <Input
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            onBlur={() =>
              team !== (reg.team ?? '') &&
              act({ type: 'set_team', team: team || null }, 'Team saved.')
            }
            placeholder="Team"
            aria-label="Team"
            className="h-11 text-sm"
          />
          <Input
            value={round}
            onChange={(e) => setRound(e.target.value)}
            onBlur={() =>
              round !== (reg.round ? String(reg.round) : '') &&
              act({ type: 'set_round', round: round ? Number(round) : null }, 'Round saved.')
            }
            placeholder="Round"
            aria-label="Round"
            inputMode="numeric"
            className="h-11 font-mono text-sm"
          />
        </section>

        <section className="border-line flex flex-col gap-3 border-t pt-6">
          <h3 className="font-display text-fg font-bold">Pass code</h3>
          <p className="text-fg-muted text-sm">
            Lost it? Check their university ID card first, then issue a new one. It is shown once.
          </p>
          {newPass ? (
            <p className="bg-accent text-fg rounded-2xl px-5 py-4 text-center font-mono text-3xl font-bold tracking-[0.3em]">
              {newPass}
            </p>
          ) : (
            <Button
              variant="secondary"
              className="self-start"
              onClick={() => act({ type: 'reset_pass' }, 'New pass code issued.')}
            >
              Reset pass code
            </Button>
          )}
        </section>
      </div>
    </Drawer>
  );
}
