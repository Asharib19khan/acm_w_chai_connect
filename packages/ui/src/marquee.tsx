'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from './cn';

interface MarqueeProps {
  items: string[];
  /** Pixels per second. */
  speed?: number;
  reverse?: boolean;
  className?: string;
  itemClassName?: string;
  separator?: ReactNode;
  label?: string;
}

/**
 * Seamless loop: the strip is rendered twice side by side and translated by −50%, so it never
 * jumps. Duration is derived from the measured width so speed stays constant for any text length.
 */
export function Marquee({
  items,
  speed = 40,
  reverse = false,
  className,
  itemClassName,
  separator = <Star />,
  label,
}: MarqueeProps) {
  const groupRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(30);
  const [copies, setCopies] = useState(2);

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const measure = () => {
      const width = group.getBoundingClientRect().width;
      const container = group.parentElement?.parentElement?.getBoundingClientRect().width ?? width;
      // Enough repeats inside one group to always overfill the container.
      setCopies(Math.max(1, Math.ceil(container / Math.max(width / copies, 1))));
      setDuration(Math.max(width / speed, 8));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(group);
    return () => observer.disconnect();
  }, [speed, copies, items]);

  const group = (hidden: boolean) => (
    <div
      ref={hidden ? undefined : groupRef}
      aria-hidden={hidden || undefined}
      className="flex shrink-0 items-center"
    >
      {Array.from({ length: copies }).flatMap((_, c) =>
        items.map((item, i) => (
          <span
            key={`${c}-${i}`}
            className={cn('flex items-center whitespace-nowrap', itemClassName)}
          >
            <span>{item}</span>
            <span className="mx-[0.9em] flex items-center" aria-hidden>
              {separator}
            </span>
          </span>
        )),
      )}
    </div>
  );

  return (
    <div
      className={cn('relative flex overflow-hidden select-none', className)}
      role="marquee"
      aria-label={label ?? items.join(', ')}
    >
      <div
        data-marquee-track
        className="animate-marquee flex w-max will-change-transform"
        style={{
          ['--cc-marquee-duration' as string]: `${duration}s`,
          animationDirection: reverse ? 'reverse' : 'normal',
        }}
      >
        {group(false)}
        {group(true)}
      </div>
    </div>
  );
}

export function Star({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-[0.7em]', className)} aria-hidden>
      <path
        d="M12 0c.6 6.4 5.6 11.4 12 12-6.4.6-11.4 5.6-12 12-.6-6.4-5.6-11.4-12-12C6.4 11.4 11.4 6.4 12 0Z"
        fill="currentColor"
      />
    </svg>
  );
}
