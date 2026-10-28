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

export const momentInitSchema = z.object({
  uploaderName: z.string().trim().min(LIMITS.nameMin, 'Add your name.').max(LIMITS.nameMax),
  title: z.string().trim().max(LIMITS.momentTitleMax).optional(),
  fileName: z.string().max(200),
  size: z.number().int().positive(),
  mime: z.string().regex(/^image\//, 'Photos only.'),
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
