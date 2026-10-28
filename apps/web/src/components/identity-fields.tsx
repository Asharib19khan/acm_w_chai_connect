'use client';

import { DEPARTMENTS, normalizeRollNumber } from '@chai/core';
import { Field, Input, Select } from '@chai/ui';

interface Props {
  rollNo: string;
  department: string;
  onRollNo: (v: string) => void;
  onDepartment: (v: string) => void;
  errors: Record<string, string>;
}

/** Roll number (normalised as you leave the field) + department. Nothing else is asked. */
export function IdentityFields({ rollNo, department, onRollNo, onDepartment, errors }: Props) {
  return (
    <div className="grid gap-5 sm:grid-cols-[1fr_1.2fr]">
      <Field label="Roll number" hint="Like 25K-5570" error={errors.rollNo}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            value={rollNo}
            onChange={(e) => onRollNo(e.target.value.toUpperCase())}
            onBlur={() => {
              const normalized = normalizeRollNumber(rollNo);
              if (normalized) onRollNo(normalized);
            }}
            placeholder="25K-5570"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={10}
            className="font-mono tracking-wider"
          />
        )}
      </Field>
      <Field label="Department" error={errors.department}>
        {({ id, describedBy, invalid }) => (
          <Select
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            value={department}
            onChange={(e) => onDepartment(e.target.value)}
          >
            <option value="" disabled>
              Pick your department
            </option>
            {DEPARTMENTS.map((d) => (
              <option key={d.code} value={d.code}>
                {d.code} · {d.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
    </div>
  );
}
