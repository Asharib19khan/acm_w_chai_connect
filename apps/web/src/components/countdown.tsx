'use client';

import { useEffect, useState } from 'react';

/** Event start: 27 November 2026, 9:00 AM Karachi time (UTC+5). */
const START = Date.parse('2026-11-27T09:00:00+05:00');
/** After this the event is over. */
const END = Date.parse('2026-11-27T23:59:59+05:00');

const UNITS = [
  ['Days', 86_400_000],
  ['Hrs', 3_600_000],
  ['Min', 60_000],
  ['Sec', 1000],
] as const;

/**
 * Live countdown to the event in huge pink digits. Renders dashes on the server and fills in on
 * the phone, so the server and phone clocks never disagree on first paint.
 */
export function Countdown() {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (now !== null && now >= START) {
    return (
      <div className="bg-accent font-display w-full px-4 py-5 text-center text-[clamp(1.6rem,7vw,4rem)] leading-none font-black tracking-[-0.04em] text-[#000] uppercase">
        {now <= END ? 'It’s happening now' : 'That’s a wrap. Thank you!'}
      </div>
    );
  }

  const parts = UNITS.map(([label, ms], i) => {
    if (now === null) return { label, value: '--' };
    // Whole units left, after taking away the bigger units.
    const bigger = i === 0 ? Infinity : UNITS[i - 1]![1];
    const v = Math.floor(((START - now) % bigger) / ms);
    return { label, value: String(v).padStart(2, '0') };
  });

  return (
    <div role="timer" aria-label="Time until Chai Connect starts" className="w-full">
      <p className="font-display mb-2 text-xs font-black tracking-[0.25em] uppercase sm:text-sm">
        Starts in
      </p>
      <div className="grid grid-cols-4 gap-1.5 sm:gap-3">
        {parts.map((p, i) => (
          <div
            key={p.label}
            className={`flex flex-col items-start px-2 py-2 sm:px-4 sm:py-3 ${i % 2 === 0 ? 'bg-accent text-[#000]' : 'text-accent bg-[#000]'}`}
          >
            <span className="font-display text-[clamp(2rem,10vw,5.5rem)] leading-none font-black tracking-[-0.05em] tabular-nums">
              {p.value}
            </span>
            <span className="font-display mt-1 text-[0.65rem] font-black tracking-[0.2em] uppercase sm:text-xs">
              {p.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
