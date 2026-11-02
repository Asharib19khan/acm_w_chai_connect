import { checkEnv, isStrictEnv } from '@chai/core';
import { z } from 'zod';

// Games desk (webdev members). It shares the database, but its sessions only work here and the
// admin portal refuses member accounts.
// Values live in Vercel (and .env.local locally), never in git. Only what the code really uses.
const secret = z.string().min(1);

export const env = checkEnv(
  process.env,
  {
    server: {
      /** Supabase Postgres through the transaction pooler (port 6543). */
      DATABASE_URL: z.string().startsWith('postgres'),
      IP_HASH_KEY: secret,
      DEVICE_TOKEN_KEY: secret,
      TOTP_ENCRYPTION_KEY: secret,
      SESSION_HMAC_KEY: secret,
      // Key asked for before "Allow another try" on a game station (amendment A8).
      RETRY_SECRET: z.string().min(6),
    },
    client: {
    },
  },
  { strict: isStrictEnv(process.env) },
);

export const isProduction = process.env.NODE_ENV === 'production';
