import { cn } from './cn';

/**
 * The Chai Connect mark: a cutting-chai glass with three wisps of steam.
 * Steam animates with CSS only and stops under prefers-reduced-motion.
 */
export function ChaiCup({ className, steam = true }: { className?: string; steam?: boolean }) {
  return (
    <svg viewBox="0 0 64 72" className={cn('overflow-visible', className)} aria-hidden fill="none">
      {steam &&
        [
          { x: 22, delay: '0s', drift: '-3px' },
          { x: 32, delay: '0.9s', drift: '4px' },
          { x: 42, delay: '1.7s', drift: '-2px' },
        ].map((wisp) => (
          <path
            key={wisp.x}
            data-steam
            d={`M${wisp.x} 22c-4-5 4-8 0-13s4-7 0-9`}
            stroke="var(--cc-plum)"
            strokeWidth="2.6"
            strokeLinecap="round"
            style={{
              animation: `cc-steam 2.6s var(--ease-out) ${wisp.delay} infinite`,
              transformBox: 'fill-box',
              transformOrigin: 'bottom',
              ['--drift' as string]: wisp.drift,
            }}
          />
        ))}
      {/* glass: a tapered cutting-chai glass */}
      <path
        d="M10 28h44l-5.5 38a5 5 0 0 1-5 4.3H20.5a5 5 0 0 1-5-4.3L10 28Z"
        fill="var(--cc-petal)"
      />
      <path
        d="M13.2 40h37.6l-3.9 26a3 3 0 0 1-3 2.6H20.1a3 3 0 0 1-3-2.6L13.2 40Z"
        fill="var(--cc-plum)"
      />
      <path d="M10 28h44" stroke="var(--cc-petal)" strokeWidth="3" strokeLinecap="round" />
      <path
        d="M19 46l2.2 16"
        stroke="var(--cc-petal)"
        strokeOpacity="0.55"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Wordmark lockup: cup + "Chai Connect" set in the display face. */
export function Wordmark({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        'font-display inline-flex items-center gap-2.5 font-bold tracking-tight',
        className,
      )}
    >
      <ChaiCup className={compact ? 'h-7 w-auto' : 'h-9 w-auto'} />
      <span className="leading-none">
        Chai<span className="text-plum">·</span>Connect
      </span>
    </span>
  );
}
