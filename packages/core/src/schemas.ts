import { z } from 'zod';
import { DEPARTMENT_CODES, LIMITS } from './constants';
import { rollNumberSchema } from './roll-number';

export const departmentSchema = z.enum(DEPARTMENT_CODES, { message: 'Pick your department.' });

export const questionInputSchema = z
  .object({
    body: z
      .string()
      .trim()
      .min(LIMITS.questionMin, `Questions need at least ${LIMITS.questionMin} characters.`)
      .max(LIMITS.questionMax, `Keep it under ${LIMITS.questionMax} characters.`),
    showName: z.boolean(),
    displayName: z.string().trim().max(LIMITS.nameMax).optional(),
    src: z
      .string()
      .trim()
      .max(40)
      .regex(/^[a-z0-9-]*$/)
      .optional(),
  })
  .refine((v) => !v.showName || (v.displayName?.length ?? 0) >= LIMITS.nameMin, {
    path: ['displayName'],
    message: 'Add your name, or switch "Show my name" off.',
  });

export const cvInputSchema = z.object({
  rollNo: rollNumberSchema,
  department: departmentSchema,
  interests: z.array(z.string().max(60)).max(12),
  interestNote: z.string().trim().max(LIMITS.interestNoteMax).optional(),
  consentShare: z.literal(true, {
    message: 'Tick the box to share your CV with partner companies.',
  }),
  consentDisplay: z.boolean(),
});

export const registrationInputSchema = z
  .object({
    rollNo: rollNumberSchema,
    department: departmentSchema,
    physical: z.string().optional(),
    mini: z.string().optional(),
  })
  .refine((v) => Boolean(v.physical || v.mini), {
    message: 'Pick at least one game.',
    path: ['physical'],
  });

export const quizJoinSchema = z.object({
  rollNo: rollNumberSchema,
  department: departmentSchema,
  acceptRules: z.literal(true, { message: 'Accept the rules to join.' }),
});

export const quizQuestionSchema = z
  .object({
    body: z.string().trim().min(3, 'Write the question.').max(200),
    options: z
      .array(
        z.object({
          id: z.string().min(1),
          text: z.string().trim().min(1, 'Options cannot be empty.').max(120),
        }),
      )
      .min(2, 'At least two options.')
      .max(6, 'At most six options.'),
    correctOptionId: z.string().min(1, 'Mark the correct option.'),
    timeLimitS: z.number().int().min(5).max(60),
    points: z.number().int().min(100).max(5000),
  })
  .refine((q) => q.options.some((o) => o.id === q.correctOptionId), {
    path: ['correctOptionId'],
    message: 'Mark the correct option.',
  });

/*
 * Share Moments names: letters from any language (so Urdu names work), plus spaces and . ' -
 * between them. No emojis, digits or symbols, and at least 3 letters. The phone strips
 * disallowed characters as they're typed; the server checks again.
 */
export const MOMENT_NAME_MIN_LETTERS = 3;
const NAME_ALLOWED = /^[\p{L}\p{M}](?:[\p{L}\p{M} .'’-]*[\p{L}\p{M}.])?$/u;
// Invisible emoji helpers (variation selectors, joiner, keycap, tag characters) count as letter
// "marks", so they'd slip past the rule above. Ban them by name.
const EMOJI_BITS = /[\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/u;
const EMOJI_BITS_ALL = new RegExp(EMOJI_BITS.source, 'gu');

export function cleanMomentName(raw: string): string {
  // Drop anything that isn't a letter, mark, space or . ' - (emojis, digits, symbols).
  return raw
    .replace(EMOJI_BITS_ALL, '')
    .replace(/[^\p{L}\p{M} .'’-]/gu, '')
    .replace(/ {2,}/g, ' ')
    .trimStart();
}

export function momentNameLetters(name: string): number {
  return name.match(/\p{L}/gu)?.length ?? 0;
}

export const momentNameSchema = z
  .string()
  .trim()
  .max(LIMITS.nameMax)
  .refine(
    (v) => NAME_ALLOWED.test(v) && !EMOJI_BITS.test(v),
    'Use letters only, no emojis or numbers.',
  )
  .refine(
    (v) => momentNameLetters(v) >= MOMENT_NAME_MIN_LETTERS,
    `Your name needs at least ${MOMENT_NAME_MIN_LETTERS} letters.`,
  );

export const momentInitSchema = z.object({
  uploaderName: momentNameSchema,
  title: z.string().trim().max(LIMITS.momentTitleMax).optional(),
  fileName: z.string().max(200),
  size: z.number().int().positive().max(LIMITS.momentMaxBytes, 'That file is over 2 GB.'),
  mime: z.string().regex(/^(image|video)\/[\w.+-]+$/, 'Photos and videos only.'),
  md5: z.string().regex(/^[a-f0-9]{32}$/),
});

/** First message of a Zod error, for form-level display. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Something is off with that form.';
}

/** Field → message map for inline errors. */
export function fieldIssues(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '_form');
    out[key] ??= issue.message;
  }
  return out;
}
