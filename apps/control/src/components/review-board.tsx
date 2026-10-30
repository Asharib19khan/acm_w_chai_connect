'use client';

import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Button, EmptyState, Input, Textarea, cn, useToast } from '@chai/ui';
import { editCvSummaryAction, editQuestionAction, reviewAction } from '@/app/admin/actions';

export interface ReviewItem {
  id: string;
  status: 'pending_scan' | 'scanned' | 'approved' | 'removed';
  flag: 'green' | 'red' | null;
  reasons: string[];
  categories: string[];
  flagSource: 'rules' | 'claude' | null;
  createdAt: string;
  reviewedBy: string | null;
  removedReason: string | null;
  title: string;
  meta: string[];
  question?: { answered: boolean; spotlight: boolean };
  cv?: {
    headline: string;
    skills: string[];
    activeContent: boolean;
    viewUrl: string;
    consentDisplay: boolean;
  };
  moment?: { coverUrl: string | null; originalUrl: string };
}

type Kind = 'questions' | 'cvs' | 'moments';
type Tab = 'red' | 'green' | 'unscanned' | 'approved' | 'removed';

const TABS: { id: Tab; label: string }[] = [
  { id: 'red', label: 'Red flags' },
  { id: 'green', label: 'Green flags' },
  { id: 'unscanned', label: 'Unscanned' },
  { id: 'approved', label: 'Approved' },
  { id: 'removed', label: 'Removed' },
];

const REASONS = [
  { id: 'inappropriate', label: 'Inappropriate' },
  { id: 'spam', label: 'Spam' },
  { id: 'duplicate', label: 'Duplicate' },
  { id: 'not_a_cv', label: 'Not a CV' },
  { id: 'other', label: 'Other' },
];

function inTab(item: ReviewItem, tab: Tab) {
  if (tab === 'approved') return item.status === 'approved';
  if (tab === 'removed') return item.status === 'removed';
  if (tab === 'unscanned') return item.status === 'pending_scan';
  return item.status === 'scanned' && item.flag === tab;
}

function since(iso: string) {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.round(m / 60)}h`;
  return `${Math.round(m / 1440)}d`;
}

export function ReviewBoard({
  kind,
  items,
  title,
}: {
  kind: Kind;
  items: ReviewItem[];
  title: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('red');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState(0);
  const [removing, setRemoving] = useState(false);
  const [pending, start] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(id);
  }, [router]);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        TABS.map((t) => [t.id, items.filter((i) => inTab(i, t.id)).length]),
      ) as Record<Tab, number>,
    [items],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items.filter(
      (i) => inTab(i, tab) && (!q || `${i.title} ${i.meta.join(' ')}`.toLowerCase().includes(q)),
    );
    // Red queue oldest first; others newest first.
    return tab === 'red' || tab === 'unscanned' ? list : [...list].reverse();
  }, [items, tab, query]);

  const current = visible[Math.min(cursor, visible.length - 1)];

  const act = (ids: string[], action: 'approve' | 'remove' | 'restore', reason?: string) =>
    start(async () => {
      const r = await reviewAction(kind, ids, action, reason);
      if (r.ok) {
        const verb =
          action === 'approve' ? 'Approved' : action === 'remove' ? 'Removed' : 'Restored';
        toast(
          `${verb} ${r.data.done}${r.data.skipped.length ? ` · ${r.data.skipped[0]}` : ''}`,
          r.data.skipped.length ? 'info' : 'success',
        );
        setSelected(new Set());
        setRemoving(false);
        router.refresh();
      } else toast(r.message, 'error');
    });

  // Keyboard: J/K move, A approve, R remove, V view, / search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input,textarea,select') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'j') setCursor((c) => Math.min(c + 1, visible.length - 1));
      if (e.key === 'k') setCursor((c) => Math.max(c - 1, 0));
      if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (!current) return;
      if (e.key === 'a' && current.status !== 'approved') act([current.id], 'approve');
      if (e.key === 'r' && current.status !== 'removed') setRemoving(true);
      if (e.key === 'v') {
        const url = current.cv?.viewUrl ?? current.moment?.originalUrl;
        if (url) window.open(url, '_blank', 'noopener');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const greens = items.filter((i) => inTab(i, 'green')).map((i) => i.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-fg text-4xl font-black tracking-tight">{title}</h1>
          <p className="text-fg-muted mt-1 text-sm">
            <kbd className="font-mono">J</kbd>/<kbd className="font-mono">K</kbd> move ·{' '}
            <kbd className="font-mono">A</kbd> approve · <kbd className="font-mono">R</kbd> remove ·{' '}
            {kind !== 'questions' && (
              <>
                <kbd className="font-mono">V</kbd> view ·{' '}
              </>
            )}
            <kbd className="font-mono">/</kbd> search
          </p>
        </div>
        <Input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          aria-label={`Search ${title.toLowerCase()}`}
          className="h-11 w-full max-w-xs"
        />
      </div>

      <LayoutGroup>
        <div
          role="tablist"
          aria-label="Review queues"
          className="-mx-1 flex gap-1 overflow-x-auto px-1"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => {
                setTab(t.id);
                setCursor(0);
                setSelected(new Set());
              }}
              className={cn(
                'relative flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold',
                tab === t.id ? 'text-fg' : 'text-fg-muted hover:text-fg',
              )}
            >
              {tab === t.id && (
                <motion.span
                  layoutId={`tab-${kind}`}
                  className="bg-accent absolute inset-0 rounded-full"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative">{t.label}</span>
              <span
                className={cn(
                  'tabular relative font-mono text-xs',
                  tab === t.id
                    ? 'text-fg/70'
                    : t.id === 'red' && counts.red > 0
                      ? 'text-danger'
                      : 'text-fg-subtle',
                )}
              >
                {counts[t.id]}
              </span>
            </button>
          ))}
        </div>
      </LayoutGroup>

      <AnimatePresence>
        {(selected.size > 0 || (tab === 'green' && greens.length > 0)) && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="bg-surface ring-edge flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 ring-1"
          >
            {selected.size > 0 ? (
              <>
                <span className="text-fg text-sm font-semibold">{selected.size} selected</span>
                {tab !== 'approved' && (
                  <Button size="sm" loading={pending} onClick={() => act([...selected], 'approve')}>
                    Approve selected
                  </Button>
                )}
                {tab !== 'removed' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => act([...selected], 'remove', 'other')}
                  >
                    Remove selected
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
              </>
            ) : (
              <>
                <span className="text-fg-muted text-sm">
                  Claude and the rules found nothing wrong with these.
                </span>
                <Button
                  size="sm"
                  loading={pending}
                  onClick={() => {
                    if (
                      window.confirm(`Approve all ${greens.length} green ${title.toLowerCase()}?`)
                    )
                      act(greens, 'approve');
                  }}
                >
                  Approve all green ({greens.length})
                </Button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {visible.length === 0 ? (
        <div className="bg-surface ring-edge rounded-[24px] ring-1">
          <EmptyState title={tab === 'red' ? 'No red flags. Nice.' : 'Nothing here.'}>
            {tab === 'red'
              ? 'New submissions appear here the moment they are flagged.'
              : 'Items move between tabs as you review them.'}
          </EmptyState>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
          <ul className="flex flex-col gap-2" aria-label={`${title} queue`}>
            <AnimatePresence initial={false}>
              {visible.map((item, i) => {
                const active = current?.id === item.id;
                return (
                  <motion.li
                    key={item.id}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20, height: 0, marginBottom: -8 }}
                    transition={{ duration: 0.22 }}
                  >
                    <div
                      className={cn(
                        'flex items-start gap-3 rounded-2xl p-4 ring-1 transition-colors',
                        active
                          ? 'bg-surface-2 ring-accent-strong'
                          : 'bg-surface ring-edge hover:ring-fg-subtle',
                      )}
                      onClick={() => setCursor(i)}
                    >
                      <input
                        type="checkbox"
                        aria-label="Select"
                        checked={selected.has(item.id)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          setSelected((s) => {
                            const next = new Set(s);
                            if (e.target.checked) next.add(item.id);
                            else next.delete(item.id);
                            return next;
                          })
                        }
                        className="mt-1 size-4.5 shrink-0 accent-[var(--cc-accent-strong)]"
                      />
                      {item.moment?.coverUrl && (
                        // eslint-disable-next-line @next/next/no-img-element -- admin-only cover preview
                        <img
                          src={item.moment.coverUrl}
                          alt=""
                          className="size-16 shrink-0 rounded-xl object-cover"
                        />
                      )}
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 flex-col gap-1.5 text-left"
                        onClick={() => setCursor(i)}
                      >
                        <span
                          className={cn(
                            'text-fg text-[0.98rem] leading-snug',
                            kind !== 'questions' && 'font-semibold',
                          )}
                        >
                          {item.title}
                        </span>
                        <span className="text-fg-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          <FlagPill item={item} />
                          {item.meta.map((m) => (
                            <span key={m}>{m}</span>
                          ))}
                          <span className="font-mono">{since(item.createdAt)}</span>
                        </span>
                      </button>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>

          {current && (
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <Detail
                kind={kind}
                item={current}
                pending={pending}
                removing={removing}
                setRemoving={setRemoving}
                act={act}
              />
            </aside>
          )}
        </div>
      )}
    </div>
  );
}

function FlagPill({ item }: { item: ReviewItem }) {
  if (item.status === 'pending_scan')
    return <span className="ring-edge self-start rounded-full px-2 py-0.5 ring-1">unscanned</span>;
  if (!item.flag) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 self-start rounded-full px-2 py-0.5 font-semibold ring-1',
        item.flag === 'red' ? 'text-danger ring-danger/50' : 'text-ok ring-ok/40',
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          item.flag === 'red' ? 'bg-danger-soft' : 'bg-ok-soft',
        )}
        aria-hidden
      />
      {item.flag}
      {item.categories.length > 0 && ` · ${item.categories.join(', ').replace(/_/g, ' ')}`}
    </span>
  );
}

function Detail({
  kind,
  item,
  pending,
  removing,
  setRemoving,
  act,
}: {
  kind: Kind;
  item: ReviewItem;
  pending: boolean;
  removing: boolean;
  setRemoving: (v: boolean) => void;
  act: (ids: string[], action: 'approve' | 'remove' | 'restore', reason?: string) => void;
}) {
  return (
    <div className="bg-surface ring-edge flex flex-col gap-5 rounded-[24px] p-6 ring-1">
      <div className="flex flex-col gap-3">
        <FlagPill item={item} />
        {item.reasons.length > 0 ? (
          <ul className="text-fg-muted flex flex-col gap-1 text-sm">
            {item.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        ) : (
          item.status !== 'pending_scan' && (
            <p className="text-fg-muted text-sm">No problems found.</p>
          )
        )}
        <p className="text-fg-subtle text-xs">
          {item.flagSource === 'claude'
            ? 'Flag by Claude'
            : item.flagSource === 'rules'
              ? 'Flag by rule checks; Claude scan pending on the laptop worker'
              : 'Waiting for a scan'}
          {item.reviewedBy && ` · last reviewed by ${item.reviewedBy}`}
          {item.removedReason && ` · removed: ${item.removedReason.replace('_', ' ')}`}
        </p>
      </div>

      {kind === 'questions' && <QuestionTools key={`${item.id}:${item.title}`} item={item} />}
      {kind === 'cvs' && item.cv && (
        <CvTools key={`${item.id}:${item.cv.headline}:${item.cv.skills.join()}`} item={item} />
      )}
      {kind === 'moments' && item.moment && (
        <div className="flex flex-col gap-3">
          {item.moment.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- admin-only cover preview
            <img src={item.moment.coverUrl} alt="Cover" className="w-full rounded-2xl" />
          )}
          <a
            href={item.moment.originalUrl}
            target="_blank"
            rel="noopener"
            className="text-accent-strong hover:text-fg text-sm font-semibold"
          >
            Open original (full quality)
          </a>
        </div>
      )}

      <div className="border-line flex flex-col gap-3 border-t pt-5">
        <AnimatePresence mode="wait" initial={false}>
          {removing ? (
            <motion.div
              key="why"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-2"
            >
              <p className="text-fg text-sm font-semibold">Why remove it?</p>
              <div className="flex flex-wrap gap-2">
                {REASONS.filter((r) => kind === 'cvs' || r.id !== 'not_a_cv').map((r) => (
                  <Button
                    key={r.id}
                    size="sm"
                    variant="secondary"
                    onClick={() => act([item.id], 'remove', r.id)}
                    disabled={pending}
                  >
                    {r.label}
                  </Button>
                ))}
                <Button size="sm" variant="ghost" onClick={() => setRemoving(false)}>
                  Cancel
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="act"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-wrap gap-2"
            >
              {item.status !== 'approved' && item.status !== 'removed' && (
                <Button loading={pending} onClick={() => act([item.id], 'approve')}>
                  Approve
                </Button>
              )}
              {item.status !== 'removed' && (
                <Button variant="secondary" onClick={() => setRemoving(true)}>
                  Remove
                </Button>
              )}
              {(item.status === 'removed' || item.status === 'approved') && (
                <Button
                  variant="secondary"
                  loading={pending}
                  onClick={() => act([item.id], 'restore')}
                >
                  {item.status === 'removed' ? 'Restore' : 'Take off screen'}
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function QuestionTools({ item }: { item: ReviewItem }) {
  const toast = useToast();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(item.title);
  const [pending, start] = useTransition();
  const run = (patch: { body?: string; answered?: boolean; spotlight?: boolean }, done: string) =>
    start(async () => {
      const r = await editQuestionAction(item.id, patch);
      if (r.ok) {
        toast(done, 'success');
        setEditing(false);
        router.refresh();
      } else toast(r.message, 'error');
    });
  return (
    <div className="flex flex-col gap-3">
      {editing ? (
        <>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={300}
            aria-label="Question text"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              loading={pending}
              onClick={() => run({ body }, 'Saved. The original is kept in the audit log.')}
            >
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <blockquote className="font-display text-fg text-xl leading-snug font-semibold">
          “{item.title}”
        </blockquote>
      )}
      {!editing && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            Fix typo
          </Button>
          {item.status === 'approved' && item.question && (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  run(
                    { spotlight: !item.question!.spotlight },
                    item.question!.spotlight ? 'Spotlight closed.' : 'On the big screen now.',
                  )
                }
              >
                {item.question.spotlight ? 'End spotlight' : 'Spotlight now'}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => run({ answered: !item.question!.answered }, 'Updated.')}
              >
                {item.question.answered ? 'Mark unanswered' : 'Mark answered'}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CvTools({ item }: { item: ReviewItem }) {
  const toast = useToast();
  const router = useRouter();
  const cv = item.cv!;
  const [headline, setHeadline] = useState(cv.headline);
  const [skills, setSkills] = useState(cv.skills.join(', '));
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-4">
      {cv.activeContent && (
        <p className="text-danger ring-danger/50 rounded-xl px-3 py-2 text-sm font-semibold ring-1">
          This PDF carries active content (scripts or actions). Do not open it outside the browser
          viewer.
        </p>
      )}
      <a
        href={cv.viewUrl}
        target="_blank"
        rel="noopener"
        className="bg-surface-2 text-fg ring-edge hover:ring-accent-strong inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold ring-1"
      >
        View PDF
      </a>
      <div className="flex flex-col gap-2">
        <p className="text-fg text-sm font-semibold">
          Screen summary {cv.consentDisplay ? '' : '(student did not consent to the screen)'}
        </p>
        <Input
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="One-line headline"
          maxLength={80}
          aria-label="Headline"
          className="h-11 text-sm"
        />
        <Input
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
          placeholder="Up to 5 skills, comma separated"
          aria-label="Skills"
          className="h-11 text-sm"
        />
        <Button
          size="sm"
          variant="secondary"
          loading={pending}
          className="self-start"
          onClick={() =>
            start(async () => {
              const r = await editCvSummaryAction(item.id, headline, skills.split(','));
              if (r.ok) {
                toast('Summary saved.', 'success');
                router.refresh();
              } else toast(r.message, 'error');
            })
          }
        >
          Save summary
        </Button>
      </div>
    </div>
  );
}
