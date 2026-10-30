'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Wordmark } from '@chai/ui';
import { deskSignOutAction } from '@/lib/auth/actions';

export function DeskHeader({ name, expiresAt }: { name: string; expiresAt: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [left, setLeft] = useState('');

  useEffect(() => {
    const tick = () => {
      const ms = Date.parse(expiresAt) - Date.now();
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      setLeft(ms > 0 ? `${h}h ${m}m left` : 'expired');
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return (
    <header className="border-line bg-surface/90 sticky top-0 z-30 border-b backdrop-blur-md">
      <div className="mx-auto flex max-w-[90rem] items-center gap-4 px-4 py-3 sm:px-6">
        <Wordmark compact className="text-fg text-[0.95rem]" />
        <span className="bg-brand text-on-brand rounded-full px-3 py-1 text-xs font-semibold">
          Games desk
        </span>
        <div className="flex-1" />
        <span className="hidden flex-col items-end leading-tight sm:flex">
          <span className="text-fg text-sm font-semibold">{name}</span>
          <span className="text-fg-subtle text-xs">{left}</span>
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await deskSignOutAction();
              router.refresh();
            })
          }
          className="text-fg-muted hover:text-danger rounded-full px-3 py-2 text-sm font-semibold"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
