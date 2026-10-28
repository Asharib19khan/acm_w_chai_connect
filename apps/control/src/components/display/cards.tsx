'use client';

import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { DisplayData } from '@chai/db';
import { AnimatedNumber, ChaiCup, QrCode, cn, useToast } from '@chai/ui';
import { answeredAction, spotlightAction } from '@/app/presenter-actions';

export type CardId = 'cvs' | 'questions' | 'quiz' | 'games' | 'spare';

export const CARDS: { id: CardId; key: string; title: string; tile: string }[] = [
  { id: 'cvs', key: '1', title: 'CVs', tile: 'col-span-4 row-span-2 col-start-1 row-start-5' },
  {
    id: 'questions',
    key: '2',
    title: 'Questions',
    tile: 'col-span-7 row-span-4 col-start-1 row-start-1',
  },
  { id: 'quiz', key: '3', title: 'Quiz', tile: 'col-span-5 row-span-3 col-start-8 row-start-1' },
  { id: 'games', key: '4', title: 'Games', tile: 'col-span-5 row-span-3 col-start-8 row-start-4' },
  {
    id: 'spare',
    key: '5',
    title: 'Brewing',
    tile: 'col-span-3 row-span-2 col-start-5 row-start-5',
  },
];

interface BodyProps {
  id: CardId;
  data: DisplayData;
  mode: 'tile' | 'full';
  studentUrl: string;
  presenter?: boolean;
}

export function CardBody({ id, data, mode, studentUrl, presenter = false }: BodyProps) {
  switch (id) {
    case 'cvs':
      return mode === 'tile' ? <CvTile data={data} /> : <CvFull data={data} />;
    case 'questions':
      return mode === 'tile' ? (
        <QuestionsTile data={data} />
      ) : (
        <QuestionsFull data={data} presenter={presenter} />
      );
    case 'quiz':
      return <QuizBody data={data} mode={mode} studentUrl={studentUrl} />;
    case 'games':
      return mode === 'tile' ? <GamesTile data={data} /> : <GamesFull data={data} />;
    case 'spare':
      return <Brewing data={data} mode={mode} />;
  }
}

/* ---------------- CVs ---------------- */

function CvTile({ data }: { data: DisplayData }) {
  const skills = useMemo(() => topSkills(data), [data]);
  return (
    <div className="flex h-full flex-col justify-between">
      <p className="flex items-baseline gap-[0.4em]">
        <span className="font-display text-plum tabular text-[4em] leading-none font-black">
          <AnimatedNumber value={data.cvCount} />
        </span>
        <span className="text-petal-72 text-[1.2em]">shared with partners</span>
      </p>
      <div className="flex flex-wrap gap-[0.5em]">
        {skills.slice(0, 5).map((s) => (
          <span key={s} className="ring-grape rounded-full px-[0.9em] py-[0.3em] text-[1em] ring-1">
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

function topSkills(data: DisplayData): string[] {
  const count = new Map<string, number>();
  for (const cv of data.cvs) for (const s of cv.skills) count.set(s, (count.get(s) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
}

function CvFull({ data }: { data: DisplayData }) {
  if (data.cvs.length === 0) return <Quiet title="CVs land here once approved." />;
  const loop = data.cvs.length > 6;
  const list = loop ? [...data.cvs, ...data.cvs] : data.cvs;
  return (
    <div className="flex h-full flex-col gap-[1.6em]">
      <p className="text-petal-72 text-[1.6em]">
        <span className="font-display text-plum font-bold">{data.cvCount}</span> CVs shared with
        partner companies. Names stay private.
      </p>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          className={cn('grid grid-cols-3 gap-[1.2em]', loop && 'cc-scroll-up')}
          style={{ ['--cc-scroll-duration' as string]: `${data.cvs.length * 5}s` }}
        >
          {list.map((cv, i) => (
            <motion.article
              key={`${cv.id}-${i}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-ink-2 ring-grape flex flex-col gap-[1em] rounded-[1.4em] p-[1.6em] ring-1"
            >
              <div className="flex items-center gap-[0.6em] text-[1.1em]">
                <span className="bg-plum text-ink rounded-full px-[0.8em] py-[0.15em] font-bold">
                  {cv.department}
                </span>
                <span className="text-petal-72">{cv.batch}</span>
              </div>
              {cv.headline && (
                <p className="font-display text-[1.5em] leading-tight font-semibold">
                  {cv.headline}
                </p>
              )}
              <div className="flex flex-wrap gap-[0.4em]">
                {cv.skills.map((s) => (
                  <span
                    key={s}
                    className="ring-grape rounded-full px-[0.8em] py-[0.25em] text-[1em] ring-1"
                  >
                    {s}
                  </span>
                ))}
              </div>
              {cv.openTo.length > 0 && (
                <p className="text-petal-72 text-[1em]">Open to {cv.openTo.join(', ')}</p>
              )}
            </motion.article>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Questions ---------------- */

function ago(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)} h ago`;
}

function QuestionsTile({ data }: { data: DisplayData }) {
  const open = data.questions.filter((q) => !q.answered);
  const newest = open[0];
  if (!newest) return <Quiet title="Questions from around campus appear here." />;
  return (
    <div className="flex h-full flex-col justify-between gap-[1.4em]">
      <AnimatePresence mode="wait">
        <motion.blockquote
          key={newest.id}
          initial={{ opacity: 0, y: 24, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="font-display text-[2.9em] leading-[1.1] font-bold tracking-tight text-balance"
        >
          “{newest.body}”
          <footer className="text-plum mt-[0.5em] font-sans text-[0.5em] font-medium">
            — {newest.name ?? 'Anonymous'}
          </footer>
        </motion.blockquote>
      </AnimatePresence>
      <div className="border-petal-12 flex flex-col gap-[0.6em] border-t pt-[1em]">
        {open.slice(1, 3).map((q) => (
          <p key={q.id} className="text-petal-72 truncate text-[1.25em]">
            {q.body}
          </p>
        ))}
        <p className="text-petal-50 text-[1em]">
          {open.length} waiting · {data.questions.length - open.length} answered
        </p>
      </div>
    </div>
  );
}

function QuestionsFull({ data, presenter }: { data: DisplayData; presenter: boolean }) {
  const toast = useToast();
  const [, start] = useTransition();
  const open = data.questions.filter((q) => !q.answered);
  const answered = data.questions.filter((q) => q.answered);
  if (data.questions.length === 0) return <Quiet title="No questions on the wall yet." />;
  const loop = open.length > 9;
  const list = loop ? [...open, ...open] : open;
  const act = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok && r.message) toast(r.message, 'error');
    });
  return (
    <div className="flex h-full flex-col gap-[1.4em]">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          className={cn('columns-3 gap-[1.2em]', loop && 'cc-scroll-up')}
          style={{ ['--cc-scroll-duration' as string]: `${open.length * 6}s` }}
        >
          {list.map((q, i) => (
            <motion.figure
              key={`${q.id}-${i}`}
              layout
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              className="group bg-ink-2 ring-grape mb-[1.2em] break-inside-avoid rounded-[1.4em] p-[1.6em] ring-1"
            >
              <blockquote className="text-[1.6em] leading-snug font-semibold text-balance">
                {q.body}
              </blockquote>
              <figcaption className="text-petal-72 mt-[0.8em] flex items-center justify-between text-[1.05em]">
                <span>— {q.name ?? 'Anonymous'}</span>
                <span>{ago(q.createdAt)}</span>
              </figcaption>
              {presenter && (
                <div className="mt-[1em] flex gap-[0.6em] opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <button
                    type="button"
                    className="bg-plum text-ink rounded-full px-[1em] py-[0.4em] text-[1em] font-bold"
                    onClick={() => act(() => spotlightAction(q.id, true))}
                  >
                    Spotlight
                  </button>
                  <button
                    type="button"
                    className="ring-grape rounded-full px-[1em] py-[0.4em] text-[1em] font-semibold ring-1"
                    onClick={() => act(() => answeredAction(q.id, true))}
                  >
                    Mark answered
                  </button>
                </div>
              )}
            </motion.figure>
          ))}
        </div>
      </div>
      {answered.length > 0 && (
        <div className="border-petal-12 text-petal-50 flex shrink-0 items-center gap-[1em] overflow-hidden border-t pt-[1em] text-[1.1em]">
          <span className="text-petal-72 shrink-0 font-semibold">Answered</span>
          {answered.slice(0, 4).map((q) => (
            <span key={q.id} className="truncate">
              {q.body}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Quiz ---------------- */

function useServerCountdown(startsAt: string | null, serverNow: number) {
  const offset = useRef(0);
  useEffect(() => {
    offset.current = serverNow - Date.now();
  }, [serverNow]);
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!startsAt) return;
    const tick = () =>
      setLeft(Math.ceil((Date.parse(startsAt) - (Date.now() + offset.current)) / 1000));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [startsAt]);
  return Math.max(left, 1);
}

function QuizBody({
  data,
  mode,
  studentUrl,
}: {
  data: DisplayData;
  mode: 'tile' | 'full';
  studentUrl: string;
}) {
  const q = data.quiz;
  const full = mode === 'full';
  const url = `${studentUrl.replace(/\/$/, '')}/quiz`;
  const n = useServerCountdown(q.startsAt, q.serverNow);

  if (q.phase === 'locked') {
    return full ? (
      <Quiet title="The quiz is locked." />
    ) : (
      <div className="flex h-full flex-col justify-end gap-[0.6em]">
        <svg viewBox="0 0 24 24" className="text-plum size-[3.6em]" aria-hidden>
          <path
            d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z"
            stroke="currentColor"
            strokeWidth="1.8"
            fill="none"
            strokeLinejoin="round"
          />
        </svg>
        <p className="text-petal-72 text-[1.4em]">Locked until the host opens it.</p>
      </div>
    );
  }

  if (q.phase === 'open') {
    return full ? (
      <div className="grid h-full grid-cols-[auto_1fr] items-center gap-[4em]">
        <QrCode value={url} className="h-[30em] w-[30em]" label="Scan to join the quiz" />
        <div className="flex flex-col gap-[1.6em]">
          <p className="font-display text-[4.4em] leading-[0.95] font-black tracking-tight">
            Scan to join.
          </p>
          <p className="font-mono text-[2em] font-bold">{url.replace(/^https?:\/\//, '')}</p>
          <p className="flex items-baseline gap-[0.4em]">
            <span className="font-display tabular text-[6em] leading-none font-black">
              <AnimatedNumber value={q.joined} />
            </span>
            <span className="text-[1.8em] font-semibold">joined</span>
          </p>
          <div className="flex flex-wrap gap-[0.5em]">
            <AnimatePresence>
              {q.joinedRolls.map((r) => (
                <motion.span
                  key={r}
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="bg-ink text-petal rounded-full px-[0.9em] py-[0.3em] font-mono text-[1.15em]"
                >
                  {r}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    ) : (
      <div className="flex h-full items-end justify-between gap-[1em]">
        <div>
          <p className="font-display tabular text-[3.4em] leading-none font-black">
            <AnimatedNumber value={q.joined} />
          </p>
          <p className="text-[1.2em] font-semibold">joined · scan to play</p>
        </div>
        <QrCode value={url} className="h-[9em] w-[9em]" />
      </div>
    );
  }

  if (q.phase === 'countdown') {
    return (
      <div className="grid h-full place-items-center">
        <AnimatePresence mode="popLayout">
          <motion.span
            key={n}
            initial={{ scale: 1.8, opacity: 0, filter: 'blur(20px)' }}
            animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
            exit={{ scale: 0.5, opacity: 0, filter: 'blur(12px)' }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'font-display tabular leading-none font-black',
              full ? 'text-[20em]' : 'text-[8em]',
            )}
          >
            {n}
          </motion.span>
        </AnimatePresence>
      </div>
    );
  }

  if (q.phase === 'live') {
    const rows = full ? q.rows : q.rows.slice(0, 3);
    return (
      <div className="flex h-full flex-col gap-[1em]">
        <p className={cn('font-semibold', full ? 'text-[1.6em]' : 'text-[1.15em]')}>
          {q.title} · {q.questionCount} questions · {q.joined} playing
          {q.disqualified ? ` · ${q.disqualified} out` : ''}
        </p>
        <Board
          rows={rows.map((r) => ({
            key: r.sessionId,
            rank: r.rank,
            label: r.rollNo,
            sub: r.department,
            score: r.score,
          }))}
          big={full}
          onPlum
        />
      </div>
    );
  }

  // ended: podium, then the top 20
  const [first, second, third] = q.rows;
  return full ? (
    <div className="grid h-full grid-cols-[1.1fr_1fr] gap-[3em]">
      <div className="flex items-end justify-center gap-[1.4em]">
        {[second, first, third].map((r, i) =>
          r ? (
            <motion.div
              key={r.sessionId}
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{
                delay: [0.4, 0.9, 0.2][i],
                type: 'spring',
                stiffness: 160,
                damping: 18,
              }}
              className="flex w-[13em] flex-col items-center gap-[0.8em]"
            >
              <span className="font-mono text-[1.6em] font-bold">{r.rollNo}</span>
              <span className="text-petal-72 font-mono text-[1.3em]">
                {r.score.toLocaleString()}
              </span>
              <div
                className={cn(
                  'font-display grid w-full place-items-start justify-center rounded-t-[1.2em] pt-[1em] font-black',
                  i === 1
                    ? 'bg-plum text-ink h-[22em]'
                    : 'bg-prussian-2 text-petal ring-grape h-[15em] ring-1',
                )}
              >
                <span className={i === 1 ? 'text-[5em] leading-none' : 'text-[3.6em] leading-none'}>
                  {r.rank}
                </span>
              </div>
            </motion.div>
          ) : null,
        )}
      </div>
      {q.rows.length > 3 ? (
        <Board
          rows={q.rows.slice(3, 20).map((r) => ({
            key: r.sessionId,
            rank: r.rank,
            label: r.rollNo,
            sub: r.department,
            score: r.score,
          }))}
        />
      ) : (
        <div className="flex flex-col justify-end gap-[0.6em]">
          <p className="font-display text-[3.4em] leading-none font-black">That’s the quiz.</p>
          <p className="text-petal-72 text-[1.6em]">
            {q.joined} played · {q.questionCount} questions
          </p>
        </div>
      )}
    </div>
  ) : (
    <div className="flex h-full flex-col justify-end">
      <p className="text-[1.2em] opacity-75">Winner</p>
      <p className="font-mono text-[2.6em] font-bold">{first?.rollNo ?? 'No players'}</p>
    </div>
  );
}

/* ---------------- Games ---------------- */

function GamesTile({ data }: { data: DisplayData }) {
  return (
    <ul className="flex h-full flex-col justify-between">
      {data.games.slice(0, 5).map((g) => (
        <li
          key={g.id}
          className="border-petal-12 flex items-baseline justify-between border-b py-[0.45em] last:border-0"
        >
          <span className="text-[1.35em] font-semibold">{g.name}</span>
          <span className="text-petal-72 flex items-baseline gap-[0.8em] text-[1.05em]">
            {g.top[0] && (
              <span className="text-petal font-mono">{g.top[0].team ?? g.top[0].rollNo}</span>
            )}
            <span>{g.players} in</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function GamesFull({ data }: { data: DisplayData }) {
  const [active, setActive] = useState(
    data.games.find((g) => g.status === 'live')?.id ?? data.games[0]?.id,
  );
  const game = data.games.find((g) => g.id === active);
  return (
    <div className="grid h-full grid-cols-[22em_1fr] gap-[3em]">
      <LayoutGroup>
        <ul className="flex flex-col gap-[0.4em]">
          {(['physical', 'mini'] as const).map((cat) => (
            <li key={cat} className="flex flex-col gap-[0.4em]">
              <p className="text-petal-50 mt-[0.6em] text-[1em] font-semibold">
                {cat === 'physical' ? 'Physical' : 'Minigames'}
              </p>
              {data.games
                .filter((g) => g.category === cat)
                .map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setActive(g.id)}
                    className={cn(
                      'relative flex items-center justify-between rounded-[1em] px-[1em] py-[0.7em] text-left text-[1.3em] font-semibold',
                      g.id === active ? 'text-ink' : 'text-petal hover:bg-petal-06',
                    )}
                  >
                    {g.id === active && (
                      <motion.span
                        layoutId="game-pick"
                        className="bg-plum absolute inset-0 rounded-[0.8em]"
                      />
                    )}
                    <span className="relative">{g.name}</span>
                    <span className="relative text-[0.75em] opacity-70">
                      {g.status === 'live' ? 'Live' : `${g.players}`}
                    </span>
                  </button>
                ))}
            </li>
          ))}
        </ul>
      </LayoutGroup>
      {game && (
        <div className="flex min-h-0 flex-col gap-[1.2em]">
          <p className="text-petal-72 text-[1.5em]">
            {game.players} players ·{' '}
            {game.status === 'live'
              ? 'live now'
              : game.status === 'ended'
                ? 'final'
                : 'registration open'}
          </p>
          {game.top.length === 0 ? (
            <Quiet title="No scores yet." />
          ) : (
            <Board
              rows={game.top.map((r) => ({
                key: r.registrationId,
                rank: r.rank,
                label: r.team ?? r.rollNo,
                sub: r.department,
                score: r.total,
              }))}
              big
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- Shared ---------------- */

interface BoardRow {
  key: string;
  rank: number;
  label: string;
  sub: string;
  score: number;
}

function Board({
  rows,
  big = false,
  onPlum = false,
}: {
  rows: BoardRow[];
  big?: boolean;
  onPlum?: boolean;
}) {
  if (rows.length === 0) return <Quiet title="Waiting for the first answers." />;
  return (
    <ol className="flex flex-col">
      {rows.map((r) => (
        <motion.li
          key={r.key}
          layout
          transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          className={cn(
            'grid grid-cols-[3em_1fr_auto] items-baseline gap-[1em] border-b py-[0.5em]',
            onPlum ? 'border-ink/15' : 'border-petal-12',
            big ? 'text-[1.7em]' : 'text-[1.25em]',
          )}
        >
          <span
            className={cn(
              'font-display tabular font-black',
              r.rank === 1 ? (onPlum ? 'text-ink' : 'text-plum') : 'opacity-60',
            )}
          >
            {r.rank}
          </span>
          <span className="flex min-w-0 items-baseline gap-[0.6em]">
            <span className="truncate font-mono font-bold">{r.label}</span>
            <span className="text-[0.7em] opacity-70">{r.sub}</span>
          </span>
          <span className="tabular font-mono font-bold">
            <AnimatedNumber value={r.score} />
          </span>
        </motion.li>
      ))}
    </ol>
  );
}

function Quiet({ title }: { title: string }) {
  return (
    <div className="flex h-full flex-col items-start justify-end gap-[0.8em]">
      <ChaiCup className="h-[4em] w-auto opacity-70" steam={false} />
      <p className="text-petal-72 text-[1.4em]">{title}</p>
    </div>
  );
}

function Brewing({ data, mode }: { data: DisplayData; mode: 'tile' | 'full' }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (mode !== 'full' || data.moments.length < 2) return;
    const id = setInterval(() => setI((x) => (x + 1) % data.moments.length), 5000);
    return () => clearInterval(id);
  }, [mode, data.moments.length]);
  if (mode === 'full' && data.moments.length > 0) {
    const m = data.moments[i % data.moments.length]!;
    return (
      <AnimatePresence mode="wait">
        <motion.figure
          key={m.id}
          initial={{ opacity: 0, scale: 1.03 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="flex h-full flex-col items-center gap-[1em]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- covers come from the student app's public cover route */}
          <img
            src={`/api/cover/${m.id}`}
            alt={m.title ?? `Photo by ${m.by}`}
            className="min-h-0 flex-1 rounded-[1.4em] object-contain"
          />
          <figcaption className="text-petal-72 text-[1.4em]">
            {m.title ? `${m.title} · ` : ''}by {m.by}
          </figcaption>
        </motion.figure>
      </AnimatePresence>
    );
  }
  return (
    <div className="flex h-full items-end justify-between">
      <p className={cn('text-petal-72', mode === 'full' ? 'text-[2em]' : 'text-[1.2em]')}>
        Something’s brewing.
      </p>
      <ChaiCup className={mode === 'full' ? 'h-[14em] w-auto' : 'h-[5em] w-auto'} />
    </div>
  );
}
