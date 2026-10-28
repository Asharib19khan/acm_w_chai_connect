import { describe, expect, it } from 'vitest';
import {
  batchFromRollNumber,
  normalizeRollNumber,
  ROLL_NUMBER_PATTERN,
  rollNumberSchema,
} from './roll-number';

describe('normalizeRollNumber', () => {
  it.each(['25K-5570', '25k5570', '25K 5570', '25k-5570', ' 25k - 5570 '])(
    'accepts %s',
    (input) => {
      expect(normalizeRollNumber(input)).toBe('25K-5570');
    },
  );

  it.each(['', '25-5570', '25K-557', '25K-55700', '2K-5570', 'K25-5570', '25L-5570', '25K_5570'])(
    'rejects %j',
    (input) => {
      expect(normalizeRollNumber(input)).toBeNull();
    },
  );

  it('always produces the stored pattern', () => {
    expect(normalizeRollNumber('19k0001')).toMatch(ROLL_NUMBER_PATTERN);
  });
});

describe('rollNumberSchema', () => {
  it('outputs the stored form', () => {
    expect(rollNumberSchema.parse('25k5570')).toBe('25K-5570');
  });

  it('gives a friendly message on bad input', () => {
    const result = rollNumberSchema.safeParse('hello');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Enter your roll number like 25K-5570.');
  });
});

describe('batchFromRollNumber', () => {
  it('reads the batch year', () => {
    expect(batchFromRollNumber('25K-5570')).toBe(2025);
  });
});
