import { describe, expect, it } from 'vitest';
import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  otpauthUrl,
  totpAt,
  verifyTotp,
} from './totp';

// RFC 6238 test secret "12345678901234567890" (SHA-1).
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('totp', () => {
  it('matches the RFC 6238 vectors (last 6 digits)', () => {
    expect(totpAt(RFC_SECRET, Math.floor(59 / 30))).toBe('287082');
    expect(totpAt(RFC_SECRET, Math.floor(1111111109 / 30))).toBe('081804');
    expect(totpAt(RFC_SECRET, Math.floor(2000000000 / 30))).toBe('279037');
  });

  it('round-trips base32', () => {
    const bytes = Buffer.from([0, 1, 2, 250, 251, 252, 253]);
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
  });

  it('accepts the current code and one step either side', () => {
    const secret = generateTotpSecret();
    const now = 1_800_000_000_000;
    const step = Math.floor(now / 30000);
    expect(verifyTotp(secret, totpAt(secret, step), { nowMs: now })).toBe(step);
    expect(verifyTotp(secret, totpAt(secret, step - 1), { nowMs: now })).toBe(step - 1);
    expect(verifyTotp(secret, totpAt(secret, step + 2), { nowMs: now })).toBeNull();
  });

  it('refuses a replayed step', () => {
    const secret = generateTotpSecret();
    const now = 1_800_000_000_000;
    const step = Math.floor(now / 30000);
    expect(verifyTotp(secret, totpAt(secret, step), { nowMs: now, lastUsedStep: step })).toBeNull();
  });

  it('refuses malformed codes', () => {
    expect(verifyTotp(generateTotpSecret(), '12a456')).toBeNull();
  });

  it('builds an authenticator URL', () => {
    expect(otpauthUrl('ABC', 'ye@example.com')).toContain(
      'otpauth://totp/ACM-W%20Chai%20Connect%3Aye%40example.com?secret=ABC',
    );
  });
});
