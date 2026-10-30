'use client';

import { useState } from 'react';
import { cn } from './cn';

interface CodeInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  length?: number;
  invalid?: boolean;
  autoFocus?: boolean;
  label?: string;
}

/**
 * Authenticator code entry: one real input (numeric keypad, paste, one-time-code autofill) laid
 * invisibly over six drawn boxes. A single input never drops digits when typing fast.
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  length = 6,
  invalid,
  autoFocus,
  label = 'Authenticator code',
}: CodeInputProps) {
  const [focused, setFocused] = useState(false);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');
  const caret = Math.min(value.length, length - 1);

  return (
    <div className="relative">
      <input
        aria-label={label}
        aria-invalid={invalid || undefined}
        value={value}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={length}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const clean = e.target.value.replace(/\D/g, '').slice(0, length);
          onChange(clean);
          if (clean.length === length) onComplete?.(clean);
        }}
        className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
      />
      <div aria-hidden className="flex justify-between gap-2">
        {digits.map((digit, i) => (
          <span
            key={i}
            className={cn(
              'bg-surface text-fg grid h-15 w-full min-w-0 place-items-center rounded-xl font-mono text-2xl ring-1 transition-shadow ring-inset',
              invalid
                ? 'ring-danger'
                : focused && i === caret
                  ? 'ring-accent-strong ring-2'
                  : 'ring-edge-strong',
            )}
          >
            {digit ||
              (focused && i === caret ? (
                <span className="cc-live-dot bg-accent-strong h-6 w-0.5" />
              ) : null)}
          </span>
        ))}
      </div>
    </div>
  );
}
