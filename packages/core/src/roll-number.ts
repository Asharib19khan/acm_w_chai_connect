import { z } from 'zod';

/** Stored form of a FAST Karachi roll number, e.g. 25K-5570. */
export const ROLL_NUMBER_PATTERN = /^[0-9]{2}K-[0-9]{4}$/;

/**
 * Turns what a student types (25k5570, 25K 5570, 25k-5570) into the stored form 25K-5570.
 * Returns null when the input can't be a roll number.
 */
export function normalizeRollNumber(input: string): string | null {
  const match = /^\s*([0-9]{2})\s*[kK]\s*[-\s]?\s*([0-9]{4})\s*$/.exec(input);
  if (!match) return null;
  return `${match[1]}K-${match[2]}`;
}

/** Zod schema that accepts the loose forms and outputs the stored form. */
export const rollNumberSchema = z.string().transform((value, ctx) => {
  const normalized = normalizeRollNumber(value);
  if (!normalized) {
    ctx.addIssue({ code: 'custom', message: 'Enter your roll number like 25K-5570.' });
    return z.NEVER;
  }
  return normalized;
});

/** Batch year from a roll number: 25K-5570 → 2025. */
export function batchFromRollNumber(rollNumber: string): number {
  return 2000 + Number(rollNumber.slice(0, 2));
}
