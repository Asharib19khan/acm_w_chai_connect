import type { ReactNode } from 'react';
import { ChaiCup } from './chai-cup';
import { cn } from './cn';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('cc-skeleton rounded-xl', className)} aria-hidden />;
}

interface StateProps {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Empty state: an empty glass, waiting to be poured. */
export function EmptyState({
  title,
  children,
  action,
  className,
  align = 'center',
}: StateProps & { align?: 'center' | 'start' }) {
  return (
    <div
      className={cn(
        'flex flex-col py-14',
        align === 'center' ? 'items-center px-6 text-center' : 'items-start text-left',
        className,
      )}
    >
      <ChaiCup className="h-14 w-auto opacity-60" steam={false} />
      <p className="font-display text-petal mt-5 text-lg font-semibold">{title}</p>
      {children && <div className="text-petal-72 mt-2 max-w-sm text-sm">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({ title, children, action, className }: StateProps) {
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center px-6 py-14 text-center', className)}
    >
      <div className="ring-coral/60 grid size-14 place-items-center rounded-full ring-1">
        <svg viewBox="0 0 24 24" className="text-coral size-6" aria-hidden>
          <path d="M12 7v6m0 4h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </div>
      <p className="font-display text-petal mt-5 text-lg font-semibold">{title}</p>
      {children && <div className="text-petal-72 mt-2 max-w-sm text-sm">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function LiveDot({ className }: { className?: string }) {
  return (
    <span
      className={cn('cc-live-dot bg-plum inline-block size-2 rounded-full', className)}
      aria-hidden
    />
  );
}
