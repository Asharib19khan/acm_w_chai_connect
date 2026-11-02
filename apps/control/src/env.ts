import { checkEnv, isStrictEnv } from '@chai/core';
import { z } from 'zod';

// Display + admin portal.
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
      /** CV PDFs go to the organiser's Drive (folder CV_FOLDER_ID) with server-held OAuth. */
      GOOGLE_OAUTH_CLIENT_ID: secret,
      GOOGLE_OAUTH_CLIENT_SECRET: secret,
      GOOGLE_DRIVE_REFRESH_TOKEN: secret,
      CV_FOLDER_ID: secret,
      SUPERADMIN_EMAIL: z.email(),
    },
    client: {
      NEXT_PUBLIC_STUDENT_SITE_URL: z.url(),
    },
  },
  { strict: isStrictEnv(process.env) },
);

export const isProduction = process.env.NODE_ENV === 'production';
