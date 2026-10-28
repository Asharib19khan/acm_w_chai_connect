import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { checkEnv, isStrictEnv } from './env-check';

const schemas = {
  server: { SUPABASE_SERVICE_ROLE_KEY: z.string().min(1) },
  client: { NEXT_PUBLIC_SITE_URL: z.url() },
};

describe('checkEnv', () => {
  it('passes with every variable in strict mode', () => {
    const env = { SUPABASE_SERVICE_ROLE_KEY: 'x', NEXT_PUBLIC_SITE_URL: 'https://chai.example' };
    expect(checkEnv(env, schemas, { strict: true })).toEqual(env);
  });

  it('fails on a missing variable in strict mode', () => {
    expect(() =>
      checkEnv({ NEXT_PUBLIC_SITE_URL: 'https://chai.example' }, schemas, { strict: true }),
    ).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('allows missing variables locally', () => {
    expect(() => checkEnv({}, schemas, { strict: false })).not.toThrow();
  });

  it('refuses a secret with a NEXT_PUBLIC_ prefix, even locally', () => {
    expect(() =>
      checkEnv({ NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: 'x' }, schemas, { strict: false }),
    ).toThrow(/exposed to the browser/);
  });

  it('never prints values', () => {
    try {
      checkEnv(
        { SUPABASE_SERVICE_ROLE_KEY: '', NEXT_PUBLIC_SITE_URL: 'secret-looking-value' },
        schemas,
        { strict: true },
      );
    } catch (error) {
      expect(String(error)).not.toContain('secret-looking-value');
    }
  });

  it('rejects a client variable without the prefix', () => {
    expect(() =>
      checkEnv({}, { server: {}, client: { SITE_URL: z.string() } }, { strict: false }),
    ).toThrow(/must start with NEXT_PUBLIC_/);
  });
});

describe('isStrictEnv', () => {
  it('is strict only on Vercel deploys', () => {
    expect(isStrictEnv({ VERCEL_ENV: 'production' })).toBe(true);
    expect(isStrictEnv({ VERCEL_ENV: 'preview' })).toBe(true);
    expect(isStrictEnv({ VERCEL_ENV: 'development' })).toBe(false);
    expect(isStrictEnv({})).toBe(false);
  });
});
