import { checkEnv, isStrictEnv } from '@chai/core';
import { z } from 'zod';

// Names from blueprint section 3 + amendments (section 0). Values live in Vercel, never in git.
// Client components must read NEXT_PUBLIC_ values as literal process.env.NEXT_PUBLIC_X so Next can inline them.
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
      TOKEN_ENCRYPTION_KEY: secret,
      GOOGLE_OAUTH_CLIENT_ID: secret,
      GOOGLE_OAUTH_CLIENT_SECRET: secret,
      CRON_SECRET: secret,
      SUPERADMIN_EMAIL: z.email(),
    },
    client: {
      NEXT_PUBLIC_SITE_URL: z.url(),
      NEXT_PUBLIC_STUDENT_SITE_URL: z.url(),
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: secret,
      // Public anon key, used only for Realtime on display_events (RLS blocks everything else).
      NEXT_PUBLIC_SUPABASE_URL: z.url(),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: secret,
    },
  },
  { strict: isStrictEnv(process.env) },
);

export const isProduction = process.env.NODE_ENV === 'production';
