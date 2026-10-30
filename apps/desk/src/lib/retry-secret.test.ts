import { describe, expect, it, vi } from 'vitest';

// The real key never appears in the repo; tests use a stand-in.
vi.mock('../env', () => ({ env: { RETRY_SECRET: '12345678' } }));

const { retrySecretMatches, retryTooMany } = await import('./retry-secret');

describe('replay secret key', () => {
  it('accepts only the exact key', () => {
    expect(retrySecretMatches('12345678')).toBe(true);
    expect(retrySecretMatches(' 12345678 ')).toBe(true);
    expect(retrySecretMatches('1234567')).toBe(false);
    expect(retrySecretMatches('')).toBe(false);
  });

  it('locks a station out after 5 wrong keys', () => {
    for (let i = 0; i < 4; i++) retrySecretMatches('wrong', 'station-a');
    expect(retryTooMany('station-a')).toBe(false);
    retrySecretMatches('wrong', 'station-a');
    expect(retryTooMany('station-a')).toBe(true);
    expect(retryTooMany('station-b')).toBe(false);
  });
});
