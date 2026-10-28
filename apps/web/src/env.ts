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
      IP_HASH_KEY: secret,
      DEVICE_TOKEN_KEY: secret,
      TOKEN_ENCRYPTION_KEY: secret,
      RELAY_TICKET_KEY: secret,
      GOOGLE_OAUTH_CLIENT_ID: secret,
      GOOGLE_OAUTH_CLIENT_SECRET: secret,
    },
    client: {
      NEXT_PUBLIC_SITE_URL: z.url(),
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: secret,
      NEXT_PUBLIC_RELAY_URL: z.url(),
    },
  },
  { strict: isStrictEnv(process.env) },
);
