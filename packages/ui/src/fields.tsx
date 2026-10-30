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
  'w-full rounded-2xl bg-surface px-4 text-fg ring-1 ring-edge-strong ring-inset placeholder:text-fg-subtle transition-shadow duration-150 hover:ring-fg-muted focus:ring-2 focus:ring-accent-strong focus:outline-none aria-[invalid=true]:ring-danger disabled:opacity-50';

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
        <label htmlFor={id} className="text-fg text-sm font-semibold">
          {label}
        </label>
        {aside}
      </div>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error && (
        <p id={hintId} className="text-fg-muted text-sm">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-danger text-sm font-medium">
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
        className="text-accent-strong pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2"
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
        <span id={`${id}-l`} className="text-fg text-sm font-semibold">
          {label}
        </span>
        {description && <span className="text-fg-muted text-sm">{description}</span>}
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
          checked ? 'bg-accent ring-accent-strong' : 'bg-surface-2 ring-edge-strong',
        )}
      >
        <span
          className={cn(
            'inline-block size-5 rounded-full shadow-sm transition-transform duration-200 ease-out',
            checked ? 'translate-x-6 bg-white' : 'bg-fg-muted translate-x-1',
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
    <label className="group text-fg flex cursor-pointer items-start gap-3 text-[0.95rem] leading-snug">
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
          'peer-focus-visible:outline-accent-strong mt-0.5 grid size-5.5 shrink-0 place-items-center rounded-md ring-1 transition-colors ring-inset peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2',
          checked
            ? 'bg-accent ring-accent-strong'
            : invalid
              ? 'ring-danger'
              : 'bg-surface ring-edge-strong group-hover:ring-fg-muted',
        )}
      >
        {checked && (
          <svg viewBox="0 0 24 24" className="text-fg size-3.5">
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
        selected
          ? 'bg-accent text-fg ring-accent-strong'
          : 'bg-surface text-fg ring-edge-strong hover:ring-fg-muted',
      )}
    >
      {children}
    </button>
  );
}
