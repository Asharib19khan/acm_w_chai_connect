'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Wordmark, cn } from '@chai/ui';
import { adminSignOutAction } from '@/app/admin/actions';

const NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/questions', label: 'Questions' },
  { href: '/admin/cvs', label: 'CVs' },
  { href: '/admin/moments', label: 'Moments' },
  { href: '/admin/quiz', label: 'Quiz' },
  { href: '/admin/team', label: 'Team', superOnly: true },
];

export function AdminHeader({
  name,
  role,
  expiresAt,
}: {
  name: string;
  role: string;
  expiresAt: string;
}) {
  const path = usePathname();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [left, setLeft] = useState('');

  useEffect(() => {
    const tick = () => {
      const ms = Date.parse(expiresAt) - Date.now();
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      setLeft(ms > 0 ? `${h}h ${m}m` : 'expired');
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return (
    <header className="border-line bg-surface/90 sticky top-0 z-30 border-b backdrop-blur-md">
      <div className="mx-auto flex max-w-[90rem] items-center gap-6 px-4 py-3 sm:px-6">
        <Link href="/admin" className="shrink-0 rounded-lg" aria-label="Admin overview">
          <Wordmark compact className="text-[0.95rem]" />
        </Link>
        <nav aria-label="Admin" className="-mx-2 flex min-w-0 flex-1 gap-1 overflow-x-auto text-sm">
          {NAV.filter((n) => !n.superOnly || role === 'superadmin').map((n) => {
            const active = n.href === '/admin' ? path === '/admin' : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1.5 font-medium transition-colors',
                  active ? 'bg-accent text-fg' : 'text-fg-muted hover:bg-wash hover:text-fg',
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex shrink-0 items-center gap-3 text-sm">
          <Link
            href="/"
            className="text-fg-muted ring-edge hover:text-fg hover:ring-accent-strong hidden rounded-full px-3 py-1.5 ring-1 md:block"
          >
            Display
          </Link>
          <span className="hidden flex-col items-end leading-tight lg:flex">
            <span className="text-fg font-semibold">{name}</span>
            <span className="text-fg-subtle text-xs">
              {role} · {left}
            </span>
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await adminSignOutAction();
                router.push('/');
              })
            }
            className="text-fg-muted hover:text-danger rounded-full px-3 py-1.5 font-semibold"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
