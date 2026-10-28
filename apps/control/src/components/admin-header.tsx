'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'motion/react';
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
  portal,
}: {
  name: string;
  role: string;
  expiresAt: string;
  portal: 'admin' | 'registrations';
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
    <header className="border-petal-12 bg-ink/85 sticky top-0 z-30 border-b backdrop-blur-md">
      <div className="mx-auto flex max-w-[90rem] items-center gap-6 px-4 py-3 sm:px-6">
        <Link href="/admin" className="shrink-0 rounded-lg" aria-label="Admin overview">
          <Wordmark compact className="text-[0.95rem]" />
        </Link>
        <div className="bg-prussian ring-grape flex shrink-0 rounded-full p-1 text-sm ring-1">
          {(['admin', 'registrations'] as const).map((p) => (
            <Link
              key={p}
              href={`/${p}`}
              className={cn(
                'relative rounded-full px-3.5 py-1.5 font-semibold',
                portal === p ? 'text-ink' : 'text-petal-72 hover:text-petal',
              )}
            >
              {portal === p && (
                <motion.span layoutId="portal" className="bg-plum absolute inset-0 rounded-full" />
              )}
              <span className="relative">{p === 'admin' ? 'Admin' : 'Registrations'}</span>
            </Link>
          ))}
        </div>
        {portal === 'admin' && (
          <nav
            aria-label="Admin"
            className="-mx-2 flex min-w-0 flex-1 gap-1 overflow-x-auto text-sm"
          >
            {NAV.filter((n) => !n.superOnly || role === 'superadmin').map((n) => {
              const active = n.href === '/admin' ? path === '/admin' : path.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'shrink-0 rounded-full px-3 py-1.5 font-medium transition-colors',
                    active ? 'bg-petal-06 text-petal' : 'text-petal-72 hover:text-petal',
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        )}
        {portal === 'registrations' && <div className="flex-1" />}
        <div className="flex shrink-0 items-center gap-3 text-sm">
          <Link
            href="/"
            className="text-petal-72 ring-grape hover:text-petal hover:ring-plum hidden rounded-full px-3 py-1.5 ring-1 md:block"
          >
            Display
          </Link>
          <span className="hidden flex-col items-end leading-tight lg:flex">
            <span className="text-petal font-semibold">{name}</span>
            <span className="text-petal-50 text-xs">
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
            className="text-petal-72 hover:text-coral rounded-full px-3 py-1.5 font-semibold"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
