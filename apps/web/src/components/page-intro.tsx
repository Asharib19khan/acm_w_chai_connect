import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChaiCup } from '@chai/ui';

export function PageIntro({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-10 sm:mb-14">
      <Link
        href="/"
        className="text-fg-muted hover:text-fg mb-8 inline-flex items-center gap-2 rounded-full text-sm transition-colors"
      >
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
          <path
            d="M19 12H5m6 6-6-6 6-6"
            stroke="currentColor"
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Home
      </Link>
      <h1 className="font-display text-fg text-[clamp(2.4rem,9vw,5rem)] leading-[0.92] font-black tracking-[-0.04em] text-balance">
        {title}
      </h1>
      {children && (
        <div className="text-fg-muted mt-5 max-w-xl text-lg leading-relaxed">{children}</div>
      )}
    </div>
  );
}

export function PageShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div
      className={`mx-auto w-full ${wide ? 'max-w-6xl' : 'max-w-2xl'} px-4 pt-4 sm:px-8 sm:pt-10`}
    >
      {children}
    </div>
  );
}

export function ClosedState({ what }: { what: string }) {
  return (
    <div className="border-line flex flex-col items-start gap-4 border-t py-12">
      <ChaiCup className="h-14 w-auto" steam={false} />
      <p className="font-display text-fg text-2xl font-semibold">{what} closed for now.</p>
      <p className="text-fg-muted max-w-md">
        Check the auditorium screen or the moving strip at the top for when it opens.
      </p>
    </div>
  );
}
