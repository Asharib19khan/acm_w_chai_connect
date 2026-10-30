import Link from 'next/link';
import {
  getControl,
  getSettings,
  listAdmins,
  listCvs,
  listMoments,
  listQuestions,
  listQuizzes,
  type Moderated,
} from '@chai/db';
import { cn } from '@chai/ui';
import { requireAdminPage } from '@/lib/auth/session';
import { MarqueeEditor } from './marquee-editor';

function tally(items: Moderated[]) {
  return {
    red: items.filter((i) => i.status === 'scanned' && i.flag === 'red').length,
    green: items.filter((i) => i.status === 'scanned' && i.flag === 'green').length,
    unscanned: items.filter((i) => i.status === 'pending_scan').length,
    approved: items.filter((i) => i.status === 'approved').length,
  };
}

export default async function AdminHome() {
  const { admin } = await requireAdminPage();
  const [questions, cvs, moments, control, quizzes, settings, admins] = await Promise.all([
    listQuestions(),
    listCvs(),
    listMoments(),
    getControl(),
    listQuizzes(),
    getSettings(),
    admin.role === 'superadmin' ? listAdmins() : Promise.resolve([]),
  ]);
  const isSuper = admin.role === 'superadmin';

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-fg text-4xl font-black tracking-tight sm:text-5xl">
          Hello, {admin.name}.
        </h1>
        <p className="text-fg-muted">
          Red flags first. Claude only suggests; you decide what reaches the big screen.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ReviewCard
          href="/admin/cvs"
          title="CVs"
          counts={tally(cvs)}
          note="Approved CVs feed the CV card on the display."
        />
        <ReviewCard
          href="/admin/questions"
          title="Questions"
          counts={tally(questions)}
          note="Approved questions go on the wall."
        />
        <Card href="/admin/quiz" title="Quiz" accent={control.phase !== 'locked'}>
          <p className="font-display text-3xl font-bold capitalize">{control.phase}</p>
          <p className="text-fg-muted text-sm">
            {control.quizTitle ? `${control.quizTitle} · ` : ''}
            {quizzes.length} {quizzes.length === 1 ? 'quiz' : 'quizzes'} ready
          </p>
        </Card>
        <ReviewCard
          href="/admin/moments"
          title="Moments"
          counts={tally(moments)}
          note="Photos from the moments site. Originals stay in Drive."
        />
        {isSuper ? (
          <Card href="/admin/team" title="Admins & settings">
            <p className="font-display text-3xl font-bold">
              {admins.filter((a) => !a.disabled).length}{' '}
              {admins.filter((a) => !a.disabled).length === 1 ? 'admin' : 'admins'}
            </p>
            <p className="text-fg-muted text-sm">
              Switches: {Object.entries(settings.switches).filter(([, on]) => on).length} of 4 open
              · Audit log · Drive
            </p>
          </Card>
        ) : (
          <div className="bg-surface/50 ring-edge/60 flex flex-col justify-between gap-6 rounded-[24px] p-6 ring-1">
            <span className="flex items-center justify-between">
              <span className="font-display text-fg-muted text-xl font-bold">
                Admins & settings
              </span>
              <svg viewBox="0 0 24 24" className="text-fg-subtle size-5" aria-label="Locked">
                <path
                  d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <p className="text-fg-subtle text-sm">Superadmin only.</p>
          </div>
        )}
      </div>

      <section
        className="bg-surface ring-edge flex flex-col gap-4 rounded-[24px] p-6 ring-1"
        aria-labelledby="marquee-h"
      >
        <div>
          <h2 id="marquee-h" className="font-display text-fg text-xl font-bold">
            Moving strip
          </h2>
          <p className="text-fg-muted text-sm">
            Push an announcement onto both screens and every student phone. It updates within
            seconds.
          </p>
        </div>
        <MarqueeEditor marquee={settings.marquee} announcement={settings.announcement} />
      </section>
    </div>
  );
}

function Card({
  href,
  title,
  children,
  accent = false,
}: {
  href: string;
  title: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex min-h-48 flex-col justify-between gap-6 rounded-[24px] p-6 ring-1 transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5',
        accent
          ? 'bg-accent text-fg ring-accent-strong'
          : 'bg-surface text-fg ring-edge hover:ring-accent-strong',
      )}
    >
      <span className="flex items-center justify-between">
        <span className="font-display text-xl font-bold">{title}</span>
        <svg
          viewBox="0 0 24 24"
          className="size-5 transition-transform group-hover:translate-x-1"
          aria-hidden
        >
          <path
            d="M5 12h14m-6-6 6 6-6 6"
            stroke="currentColor"
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <div className="flex flex-col gap-1">{children}</div>
    </Link>
  );
}

function ReviewCard({
  href,
  title,
  counts,
  note,
}: {
  href: string;
  title: string;
  counts: ReturnType<typeof tally>;
  note: string;
}) {
  return (
    <Card href={href} title={title}>
      <div className="flex items-end gap-5">
        <Stat value={counts.red} label="red" tone="text-danger" />
        <Stat value={counts.green} label="green" tone="text-ok" />
        <Stat value={counts.unscanned} label="unscanned" tone="text-fg-muted" />
        <Stat value={counts.approved} label="live" tone="text-accent-strong" />
      </div>
      <p className="text-fg-muted mt-2 text-sm">{note}</p>
    </Card>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <span className="flex flex-col">
      <span className={cn('tabular font-mono text-3xl font-bold', tone)}>{value}</span>
      <span className="text-fg-muted text-xs">{label}</span>
    </span>
  );
}
