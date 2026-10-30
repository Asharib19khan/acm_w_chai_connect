import { useId } from 'react';
import { cn } from './cn';

const STEAM = [
  { x: 23, delay: '0s', drift: '-3px', d: 'M23 25c-3.5-4 3-6.5 0-10.5s3.5-6 0-10' },
  { x: 32, delay: '1.1s', drift: '3.5px', d: 'M32 25c3.5-4-3-6.5 0-10.5s-3.5-6 0-10' },
  { x: 41, delay: '2.1s', drift: '-2px', d: 'M41 25c-3.5-4 3-6.5 0-10.5s3.5-6 0-10' },
];

/**
 * The Chai Connect mark: a faceted cutting-chai glass, two-tone chai with a gently swaying
 * surface, and soft steam that widens and fades as it rises. CSS animation only; it all holds
 * still under prefers-reduced-motion.
 */
export function ChaiCup({ className, steam = true }: { className?: string; steam?: boolean }) {
  const uid = useId().replace(/:/g, '');
  const id = (name: string) => `cc-cup-${name}-${uid}`;
  return (
    <svg viewBox="0 0 64 72" className={cn('overflow-visible', className)} aria-hidden fill="none">
      <defs>
        <linearGradient
          id={id('steam')}
          x1="0"
          y1="25"
          x2="0"
          y2="3"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="var(--cc-accent-strong)" stopOpacity="0.85" />
          <stop offset="1" stopColor="var(--cc-accent-strong)" stopOpacity="0" />
        </linearGradient>
        <filter id={id('soft')} x="-50%" y="-20%" width="200%" height="140%">
          <feGaussianBlur stdDeviation="0.9" />
        </filter>
        <linearGradient
          id={id('chai')}
          x1="0"
          y1="38"
          x2="0"
          y2="70"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="var(--cc-plum)" />
          <stop offset="1" stopColor="color-mix(in srgb, var(--cc-plum) 62%, var(--cc-ink))" />
        </linearGradient>
        <linearGradient
          id={id('glass')}
          x1="10"
          y1="0"
          x2="54"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="var(--cc-white, #fff)" stopOpacity="0.9" />
          <stop offset="0.45" stopColor="var(--cc-petal)" />
          <stop offset="1" stopColor="color-mix(in srgb, var(--cc-petal) 75%, var(--cc-grape))" />
        </linearGradient>
        <clipPath id={id('inside')}>
          <path d="M11.6 29.4h40.8l-5.3 36.4a3.6 3.6 0 0 1-3.6 3.1H20.5a3.6 3.6 0 0 1-3.6-3.1L11.6 29.4Z" />
        </clipPath>
      </defs>

      {steam && (
        <g filter={`url(#${id('soft')})`}>
          {STEAM.map((wisp) => (
            <path
              key={wisp.x}
              data-steam
              d={wisp.d}
              stroke={`url(#${id('steam')})`}
              strokeWidth="3.4"
              strokeLinecap="round"
              style={{
                animation: `cc-steam 3.2s cubic-bezier(0.33, 0, 0.4, 1) ${wisp.delay} infinite`,
                transformBox: 'fill-box',
                transformOrigin: 'bottom center',
                opacity: 0,
                ['--drift' as string]: wisp.drift,
              }}
            />
          ))}
        </g>
      )}

      {/* glass body */}
      <path
        d="M10 28h44l-5.5 38a5 5 0 0 1-5 4.3H20.5a5 5 0 0 1-5-4.3L10 28Z"
        fill={`url(#${id('glass')})`}
      />
      <g clipPath={`url(#${id('inside')})`}>
        {/* chai, with a lighter surface that sways a little */}
        <rect x="8" y="39" width="48" height="34" fill={`url(#${id('chai')})`} />
        <g
          data-chai-surface
          style={{
            animation: 'cc-chai-sway 4.2s ease-in-out infinite',
            transformBox: 'fill-box',
            transformOrigin: 'center',
          }}
        >
          <ellipse
            cx="32"
            cy="39.4"
            rx="22"
            ry="2.1"
            fill="color-mix(in srgb, var(--cc-plum) 55%, white)"
          />
          <ellipse cx="32" cy="40.3" rx="22" ry="1.2" fill="var(--cc-plum)" opacity="0.6" />
        </g>
        {/* cutting-chai facets */}
        {[18.5, 25, 32, 39, 45.5].map((x, i) => (
          <path
            key={x}
            d={`M${x + (x - 32) * 0.08} 30 L${x - (x - 32) * 0.1} 68`}
            stroke="var(--cc-ink)"
            strokeOpacity={0.09 + (i === 4 ? 0.05 : 0)}
            strokeWidth="1.1"
          />
        ))}
        {/* reflection down the left side */}
        <path
          d="M16.4 32.5l3.6 32"
          stroke="white"
          strokeOpacity="0.7"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M21 32.5l1 7"
          stroke="white"
          strokeOpacity="0.45"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </g>
      {/* outline and thick rim */}
      <path
        d="M10 28h44l-5.5 38a5 5 0 0 1-5 4.3H20.5a5 5 0 0 1-5-4.3L10 28Z"
        stroke="var(--cc-ink)"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path d="M8 28h48" stroke="var(--cc-ink)" strokeWidth="3.2" strokeLinecap="round" />
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
        'font-display inline-flex items-center gap-1.5 font-bold tracking-tight',
        className,
      )}
    >
      {/* The top ~40% of the cup's drawing is steam headroom, so centring the whole SVG leaves
          the glass sitting low. Lift it so the glass, not the steam box, centres on the text. */}
      <ChaiCup
        className={cn(compact ? 'h-8 w-auto' : 'h-10 w-auto', '-translate-y-[17%] shrink-0')}
      />
      <span className="leading-none">
        Chai<span className="text-accent-strong">·</span>Connect
      </span>
    </span>
  );
}
