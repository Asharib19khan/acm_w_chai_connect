'use client';

import {
  useId,
  type ComponentProps,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from './cn';

const control =
  'w-full rounded-2xl bg-ink-2 px-4 text-petal ring-1 ring-grape ring-inset placeholder:text-petal-50 transition-shadow duration-150 hover:ring-petal-50 focus:ring-2 focus:ring-plum focus:outline-none aria-[invalid=true]:ring-coral disabled:opacity-50';

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
  className?: string;
  aside?: ReactNode;
}

/** Label + control + hint/error, wired for screen readers. */
export function Field({ label, hint, error, children, className, aside }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-petal text-sm font-semibold">
          {label}
        </label>
        {aside}
      </div>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error && (
        <p id={hintId} className="text-petal-72 text-sm">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-coral text-sm font-medium">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className, ...rest }: ComponentProps<'input'>) {
  return <input className={cn(control, 'h-13 text-base', className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(control, 'min-h-36 resize-y py-3.5 text-base leading-relaxed', className)}
      {...rest}
    />
  );
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn(control, 'h-13 appearance-none pr-11 text-base', className)} {...rest}>
        {children}
      </select>
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="text-plum pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2"
      >
        <path
          d="m6 9 6 6 6-6"
          stroke="currentColor"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, description, disabled }: SwitchProps) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <span id={`${id}-l`} className="text-petal text-sm font-semibold">
          {label}
        </span>
        {description && <span className="text-petal-72 text-sm">{description}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-l`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full ring-1 transition-colors duration-200 ring-inset disabled:opacity-50',
          checked ? 'bg-plum ring-plum' : 'bg-ink-2 ring-grape',
        )}
      >
        <span
          className={cn(
            'inline-block size-5 rounded-full shadow-sm transition-transform duration-200 ease-out',
            checked ? 'bg-ink translate-x-6' : 'bg-petal-72 translate-x-1',
          )}
        />
      </button>
    </div>
  );
}

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  invalid?: boolean;
}

export function Checkbox({ checked, onChange, children, invalid }: CheckboxProps) {
  return (
    <label className="group text-petal flex cursor-pointer items-start gap-3 text-[0.95rem] leading-snug">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-invalid={invalid || undefined}
      />
      <span
        aria-hidden
        className={cn(
          'peer-focus-visible:outline-plum mt-0.5 grid size-5.5 shrink-0 place-items-center rounded-md ring-1 transition-colors ring-inset peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2',
          checked
            ? 'bg-plum ring-plum'
            : invalid
              ? 'ring-coral'
              : 'ring-grape group-hover:ring-petal-50',
        )}
      >
        {checked && (
          <svg viewBox="0 0 24 24" className="text-ink size-3.5">
            <path
              d="m5 12 5 5 9-10"
              stroke="currentColor"
              strokeWidth="3.2"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        )}
      </span>
      <span>{children}</span>
    </label>
  );
}

interface ChipProps {
  selected: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function ChoiceChip({ selected, onToggle, children }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(
        'h-10 rounded-full px-4 text-sm font-medium ring-1 transition-[background-color,color,box-shadow] duration-150 ring-inset',
        selected ? 'bg-plum text-ink ring-plum' : 'text-petal ring-grape hover:ring-petal-50',
      )}
    >
      {children}
    </button>
  );
}
