import { describe, expect, it } from 'vitest';
import { cleanMomentName, momentNameSchema } from './schemas';

describe('Share Moments name rule', () => {
  const ok = (v: string) => momentNameSchema.safeParse(v).success;
  it('accepts real names in any script', () => {
    for (const v of ['Ali', 'Asharib Khan', "O'Brien", 'Mary-Jane', 'Dr. Sana', 'علی', 'Anonymous'])
      expect(ok(v), v).toBe(true);
  });
  it('rejects emojis, digits, symbols and short names', () => {
    for (const v of [
      'Al',
      'A',
      '',
      '   ',
      'Ali 😀',
      '😀😀😀',
      'Ali123',
      'A.l',
      'Ali!',
      '-Ali',
      '<b>Ali',
      'Ali❤️',
      'Sa️ra',
      'Ali 1️⃣',
    ])
      expect(ok(v), v).toBe(false);
  });
  it('strips emojis and symbols as people type', () => {
    expect(cleanMomentName('Ali 😀 Khan')).toBe('Ali Khan');
    expect(cleanMomentName('👋Sana')).toBe('Sana');
    expect(cleanMomentName('Ali123!')).toBe('Ali');
    expect(cleanMomentName('Zara ❤️')).toBe('Zara ');
  });
});
