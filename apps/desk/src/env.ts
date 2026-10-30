import { checkEnv, isStrictEnv } from '@chai/core';
import { z } from 'zod';

// Games desk (webdev members). It shares the database, but its sessions only work here and the
// admin portal refuses member accounts. Values live in Vercel, never in git.
const secret = z.string().min(1);

export const env = checkEnv(
  process.env,
  {
    server: {
      SUPABASE_URL: z.url(),
      SUPABASE_SERVICE_ROLE_KEY: secret,
      UPSTASH_REDIS_REST_URL: z.url(),
      UPSTASH_REDIS_REST_TOKEN: secret,
      TURNSTILE_SECRET_KEY: secret,
      TOTP_ENCRYPTION_KEY: secret,
      SESSION_HMAC_KEY: secret,
      IP_HASH_KEY: secret,
      // Key asked for before "Allow another try" on a game station (amendment A8).
      RETRY_SECRET: z.string().min(6),
    },
    client: {
      NEXT_PUBLIC_SITE_URL: z.url(),
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: secret,
    },
  },
  { strict: isStrictEnv(process.env) },
);

export const isProduction = process.env.NODE_ENV === 'production';
