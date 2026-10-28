'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { AnimatedNumber, Button, ButtonLink, ChaiCup, Checkbox, LiveDot, cn } from '@chai/ui';
import { IdentityFields } from '@/components/identity-fields';
import { joinQuizAction } from './actions';

type Phase = 'locked' | 'open' | 'countdown' | 'live' | 'ended';

interface Me {
  rollNo: string;
  status: 'active' | 'finished' | 'disqualified';
  dqReason: string | null;
  answered: number;
  total: number;
  score: number | null;
  rank: number | null;
}

interface State {
  phase: Phase;
  quizTitle: string | null;
  startsInMs: number | null;
  joinedCount: number;
  serverNow: number;
  me: Me | null;
  results:
    | { body: string; correct: string; yours: string | null; gotIt: boolean; points: number }[]
    | null;
  /** Local clock time the countdown hits zero, computed when the poll arrives. */
  startsAtLocal: number;
}

interface Question {
  id: string;
  body: string;
  options: { id: string; text: string }[];
  index: number;
  total: number;
  timeLimitS: number;
  remainingMs: number;
}

type Next =
  | { kind: 'question'; question: Question }
  | { kind: 'done'; score: number }
  | { kind: 'disqualified'; reason: string }
  | { kind: 'waiting' };

const post = async <T,>(url: string, body?: unknown): Promise<T> => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data;
};

export function QuizClient() {
  const [state, setState] = useState<State | null>(null);
  const [offline, setOffline] = useState(false);
  const offset = useRef(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [final, setFinal] = useState<
    { kind: 'done'; score: number } | { kind: 'disqualified'; reason: string } | null
  >(null);
  const fetchingNext = useRef(false);

  const poll = useCallback(async () => {
    const t0 = Date.now();
    try {
      const res = await fetch('/api/quiz/state', { cache: 'no-store' });
      const data = (await res.json()) as State;
      const t1 = Date.now();
      // Clock sync: server time minus the midpoint of the round trip.
      offset.current = data.serverNow - (t0 + t1) / 2;
      setState({ ...data, startsAtLocal: t1 + (data.startsInMs ?? 0) });
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(poll, 0);
    const id = setInterval(poll, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [poll]);

  const joined = Boolean(state?.me);
  const running = state?.phase === 'live' || state?.phase === 'countdown';

  // Heartbeat every 5 s once joined.
  useEffect(() => {
    if (!joined || state?.phase === 'ended') return;
    const beat = () =>
      fetch('/api/quiz/heartbeat', { method: 'POST' }).catch(() => setOffline(true));
    beat();
    const id = setInterval(beat, 5000);
    return () => clearInterval(id);
  }, [joined, state?.phase]);

  // Leaving the tab (or closing/reloading) during the quiz disqualifies.
  useEffect(() => {
    if (!joined || !running || state?.me?.status !== 'active') return;
    const report = (why: string) => navigator.sendBeacon('/api/quiz/violation', why);
    const onVis = () => document.visibilityState === 'hidden' && report('hidden');
    const onHide = () => report('pagehide');
    const block = (e: Event) => e.preventDefault();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);
    document.addEventListener('contextmenu', block);
    document.addEventListener('copy', block);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('contextmenu', block);
      document.removeEventListener('copy', block);
    };
  }, [joined, running, state?.me?.status]);

  const applyNext = useCallback((next: Next) => {
    if (next.kind === 'question') setQuestion(next.question);
    else if (next.kind === 'done' || next.kind === 'disqualified') {
      setQuestion(null);
      setFinal(next);
    }
  }, []);

  const loadNext = useCallback(async () => {
    if (fetchingNext.current) return;
    fetchingNext.current = true;
    try {
      applyNext(await post<Next>('/api/quiz/next'));
    } catch {
      setOffline(true);
    } finally {
      fetchingNext.current = false;
    }
  }, [applyNext]);

  // When the quiz goes live, ask for the first question.
  useEffect(() => {
    if (state?.phase !== 'live' || state.me?.status !== 'active' || question || final) return;
    const id = setTimeout(loadNext, 0);
    return () => clearTimeout(id);
  }, [state?.phase, state?.me?.status, question, final, loadNext]);

  if (!state) return <QuizSkeleton />;

  const me = state.me;
  const dq = final?.kind === 'disqualified' || me?.status === 'disqualified';

  return (
    <div className={cn('relative', running && 'cc-locked')}>
      <AnimatePresence>
        {offline && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            role="status"
            className="bg-coral text-ink fixed inset-x-0 top-0 z-50 py-2 text-center text-sm font-semibold"
          >
            Reconnecting… stay on this page.
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {state.phase === 'locked' ? (
          <Screen key="locked">
            <ChaiCup className="h-16 w-auto" steam={false} />
            <h2 className="font-display text-3xl font-bold">The quiz isn’t open yet.</h2>
            <p className="text-petal-72">
              It opens on the auditorium screen. This page updates by itself.
            </p>
          </Screen>
        ) : dq ? (
          <Screen key="dq">
            <h2 className="font-display text-coral text-3xl font-bold">Disqualified</h2>
            <p className="text-petal-72">
              {final?.kind === 'disqualified' ? final.reason : me?.dqReason}. If this was a mistake
              (a phone call, a dead battery), tell an admin at the desk; they can reinstate you with
              the answers you already gave.
            </p>
          </Screen>
        ) : !me ? (
          state.phase === 'open' ? (
            <JoinForm key="join" title={state.quizTitle} onJoined={poll} />
          ) : (
            <Screen key="closed">
              <h2 className="font-display text-3xl font-bold">Joining has closed.</h2>
              <p className="text-petal-72">
                This round is already running. Watch the big screen for the next one.
              </p>
            </Screen>
          )
        ) : state.phase === 'open' ? (
          <WaitingRoom key="wait" state={state} />
        ) : state.phase === 'countdown' ? (
          <Countdown key="count" startsAt={state.startsAtLocal} />
        ) : state.phase === 'live' && question && !final ? (
          <QuestionCard
            key={question.id}
            question={question}
            rollNo={me.rollNo}
            onAnswered={applyNext}
            onExpired={loadNext}
          />
        ) : state.phase === 'live' && !final && me.status === 'active' ? (
          <Screen key="ready">
            <h2 className="font-display text-3xl font-bold">Here it comes…</h2>
          </Screen>
        ) : state.phase === 'ended' ? (
          <Results key="results" state={state} />
        ) : (
          <Screen key="done">
            <ChaiCup className="h-16 w-auto" />
            <h2 className="font-display text-3xl font-bold">Done!</h2>
            <p className="text-petal-72">
              You scored{' '}
              <span className="text-petal font-mono">
                <AnimatedNumber value={final?.kind === 'done' ? final.score : (me.score ?? 0)} />
              </span>
              . Your rank goes up on the big screen when the quiz ends.
            </p>
          </Screen>
        )}
      </AnimatePresence>
    </div>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -12, filter: 'blur(6px)' }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="border-petal-12 text-petal flex flex-col items-start gap-4 border-t pt-10"
    >
      {children}
    </motion.div>
  );
}

function QuizSkeleton() {
  return (
    <div className="border-petal-12 flex flex-col gap-4 border-t pt-10" aria-busy>
      <div className="cc-skeleton h-10 w-2/3 rounded-xl" />
      <div className="cc-skeleton h-5 w-1/2 rounded-lg" />
      <div className="cc-skeleton mt-4 h-14 w-full rounded-2xl" />
    </div>
  );
}

function JoinForm({ title, onJoined }: { title: string | null; onJoined: () => void }) {
  const [rollNo, setRollNo] = useState('');
  const [department, setDepartment] = useState('');
  const [accept, setAccept] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <motion.form
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="border-petal-12 flex flex-col gap-8 border-t pt-10"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const result = await joinQuizAction({ rollNo, department, acceptRules: accept });
          if (result.ok) onJoined();
          else {
            setErrors(result.fields ?? {});
            setFormError(result.fields ? null : result.message);
          }
        });
      }}
    >
      <div className="flex items-center gap-3">
        <LiveDot />
        <span className="font-display text-xl font-semibold">{title ?? 'Quiz'} is open</span>
      </div>
      <IdentityFields
        rollNo={rollNo}
        department={department}
        onRollNo={setRollNo}
        onDepartment={setDepartment}
        errors={errors}
      />
      <div className="bg-prussian ring-grape flex flex-col gap-3 rounded-3xl p-5 ring-1 sm:p-6">
        <p className="font-display text-petal font-semibold">Before you join</p>
        <ul className="text-petal-72 marker:text-plum flex list-disc flex-col gap-1.5 pl-5 text-[0.95rem]">
          <li>One question at a time, each on a timer.</li>
          <li>Your answer locks the moment you tap it. No going back.</li>
          <li>Leaving this tab, reloading or going offline disqualifies you.</li>
          <li>Faster right answers score more. Wrong answers score nothing.</li>
        </ul>
        <div className="mt-2">
          <Checkbox checked={accept} onChange={setAccept} invalid={Boolean(errors.acceptRules)}>
            I accept the rules.
          </Checkbox>
        </div>
      </div>
      {formError && (
        <p role="alert" className="text-coral text-sm font-medium">
          {formError}
        </p>
      )}
      <Button type="submit" size="lg" loading={pending} disabled={!accept} className="self-start">
        Join the quiz
      </Button>
    </motion.form>
  );
}

function WaitingRoom({ state }: { state: State }) {
  return (
    <Screen>
      <div className="flex items-center gap-3">
        <LiveDot />
        <span className="text-plum text-sm font-semibold">You’re in as {state.me?.rollNo}</span>
      </div>
      <h2 className="font-display text-[clamp(2rem,8vw,3.5rem)] leading-[0.95] font-black tracking-tight">
        Waiting for the go signal.
      </h2>
      <p className="text-petal-72 max-w-md">
        Keep this page open and your screen on. The countdown starts on everyone’s phone at the same
        moment.
      </p>
      <div className="mt-6 flex items-baseline gap-3">
        <span className="text-petal tabular font-mono text-6xl font-bold">
          <AnimatedNumber value={state.joinedCount} />
        </span>
        <span className="text-petal-72">players in the room</span>
      </div>
      <SteamRoom />
    </Screen>
  );
}

function SteamRoom() {
  return (
    <div className="mt-6 flex gap-6 opacity-80" aria-hidden>
      {[0, 1, 2].map((i) => (
        <ChaiCup key={i} className="h-12 w-auto" />
      ))}
    </div>
  );
}

function Countdown({ startsAt }: { startsAt: number }) {
  const [left, setLeft] = useState(5);
  useEffect(() => {
    const id = setInterval(() => setLeft(Math.ceil((startsAt - Date.now()) / 1000)), 100);
    return () => clearInterval(id);
  }, [startsAt]);
  const n = Math.max(left, 1);
  return (
    <motion.div
      className="grid min-h-[60dvh] place-items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
    >
      <AnimatePresence mode="popLayout">
        <motion.span
          key={n}
          initial={{ scale: 1.6, opacity: 0, filter: 'blur(16px)' }}
          animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
          exit={{ scale: 0.6, opacity: 0, filter: 'blur(10px)' }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="font-display text-plum tabular text-[clamp(9rem,45vw,16rem)] leading-none font-black"
          aria-live="assertive"
        >
          {n}
        </motion.span>
      </AnimatePresence>
    </motion.div>
  );
}

function QuestionCard({
  question,
  rollNo,
  onAnswered,
  onExpired,
}: {
  question: Question;
  rollNo: string;
  onAnswered: (next: Next) => void;
  onExpired: () => void;
}) {
  const reduce = useReducedMotion();
  const [picked, setPicked] = useState<string | null>(null);
  const deadline = useRef(0);
  const [left, setLeft] = useState(question.remainingMs);

  useEffect(() => {
    deadline.current = Date.now() + question.remainingMs;
  }, [question.remainingMs]);

  useEffect(() => {
    const id = setInterval(() => {
      if (!deadline.current) return;
      const ms = deadline.current - Date.now();
      setLeft(Math.max(ms, 0));
      // The on-screen timer is only a display; the server measures the real time.
      if (ms <= -300 && !picked) {
        clearInterval(id);
        onExpired();
      }
    }, 100);
    return () => clearInterval(id);
  }, [picked, onExpired]);

  const choose = async (optionId: string) => {
    if (picked) return;
    setPicked(optionId);
    try {
      const res = await post<Next & { locked: boolean }>('/api/quiz/answer', {
        questionId: question.id,
        optionId,
      });
      // Let the lock animation land before the next card slides in.
      setTimeout(() => onAnswered(res), reduce ? 0 : 420);
    } catch {
      setPicked(null);
    }
  };

  const fraction = left / (question.timeLimitS * 1000);

  return (
    <motion.section
      initial={{ x: 60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -60, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      className="bg-prussian ring-grape relative overflow-hidden rounded-[28px] p-5 ring-1 sm:p-8"
      aria-label={`Question ${question.index + 1} of ${question.total}`}
    >
      <Watermark text={rollNo} />
      <div className="relative flex items-center justify-between text-sm">
        <span className="text-petal-72 font-semibold">
          {question.index + 1} / {question.total}
        </span>
        <span
          className={cn(
            'tabular font-mono font-bold',
            fraction < 0.25 ? 'text-coral' : 'text-petal',
          )}
        >
          {Math.ceil(left / 1000)}s
        </span>
      </div>
      <div className="bg-petal-12 relative mt-3 h-1.5 overflow-hidden rounded-full">
        <div
          className={cn(
            'h-full origin-left rounded-full transition-[transform] duration-100 ease-linear',
            fraction < 0.25 ? 'bg-coral' : 'bg-plum',
          )}
          style={{ transform: `scaleX(${Math.max(fraction, 0)})` }}
        />
      </div>
      <h2 className="font-display text-petal relative mt-7 text-[clamp(1.4rem,5.5vw,2.2rem)] leading-tight font-bold text-balance">
        {question.body}
      </h2>
      <div className="relative mt-7 grid gap-3">
        {question.options.map((option, i) => {
          const isPicked = picked === option.id;
          return (
            <motion.button
              key={option.id}
              type="button"
              disabled={Boolean(picked)}
              onClick={() => choose(option.id)}
              animate={isPicked ? { scale: [1, 0.97, 1] } : picked ? { opacity: 0.35 } : {}}
              transition={{ duration: 0.35 }}
              className={cn(
                'flex min-h-16 items-center gap-4 rounded-2xl px-5 py-4 text-left text-[1.05rem] font-semibold ring-1 transition-colors ring-inset',
                isPicked
                  ? 'bg-plum text-ink ring-plum'
                  : 'bg-ink-2 text-petal ring-grape hover:ring-plum active:bg-plum-16',
              )}
            >
              <span
                className={cn(
                  'grid size-8 shrink-0 place-items-center rounded-full font-mono text-sm',
                  isPicked ? 'bg-ink text-plum' : 'bg-petal-06 text-petal-72',
                )}
              >
                {String.fromCharCode(65 + i)}
              </span>
              {option.text}
              {isPicked && (
                <svg viewBox="0 0 24 24" className="ml-auto size-5" aria-label="Locked">
                  <path
                    d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    fill="none"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </motion.button>
          );
        })}
      </div>
    </motion.section>
  );
}

/** Roll number tiled diagonally behind the question, so photos trace back to a phone. */
function Watermark({ text }: { text: string }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -inset-20 flex rotate-[-24deg] flex-wrap content-center gap-x-10 gap-y-8 opacity-[0.07]"
    >
      {Array.from({ length: 40 }).map((_, i) => (
        <span key={i} className="text-petal font-mono text-lg font-bold">
          {text}
        </span>
      ))}
    </div>
  );
}

function Results({ state }: { state: State }) {
  const me = state.me;
  return (
    <Screen>
      <h2 className="font-display text-[clamp(2rem,8vw,3.5rem)] leading-[0.95] font-black tracking-tight">
        That’s the quiz.
      </h2>
      {me && me.status !== 'disqualified' && (
        <div className="mt-2 flex flex-wrap items-end gap-10">
          <div>
            <p className="text-petal-72 text-sm">Score</p>
            <p className="text-plum tabular font-mono text-5xl font-bold">
              <AnimatedNumber value={me.score ?? 0} />
            </p>
          </div>
          {me.rank && (
            <div>
              <p className="text-petal-72 text-sm">Rank</p>
              <p className="text-petal tabular font-mono text-5xl font-bold">#{me.rank}</p>
            </div>
          )}
        </div>
      )}
      {state.results && (
        <ol className="border-petal-12 mt-6 w-full border-t">
          {state.results.map((r, i) => (
            <li key={i} className="border-petal-12 flex flex-col gap-1 border-b py-4">
              <span className="text-petal font-semibold">{r.body}</span>
              <span className="text-petal-72 text-sm">
                Answer: <span className="text-mint">{r.correct}</span>
                {!r.gotIt && (
                  <>
                    {' '}
                    · You: <span className="text-coral">{r.yours ?? 'no answer'}</span>
                  </>
                )}
                {r.gotIt && <span className="text-petal font-mono"> · +{r.points}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
      {!me && (
        <ButtonLink href="/leaderboard" variant="secondary">
          See the leaderboard
        </ButtonLink>
      )}
    </Screen>
  );
}
