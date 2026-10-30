import { checkEnv, isStrictEnv } from '@chai/core';
import { z } from 'zod';

// Share Moments site. Values live in Vercel (and apps/moments/.env.local locally), never in git.
// No Drive URL or token ever reaches the phone. This site has no database: uploads go to Drive.
const secret = z.string().min(1);

export const env = checkEnv(
  process.env,
  {
    server: {
      GOOGLE_OAUTH_CLIENT_ID: secret,
      GOOGLE_OAUTH_CLIENT_SECRET: secret,
      GOOGLE_DRIVE_REFRESH_TOKEN: secret,
      IP_HASH_KEY: secret,
      DEVICE_TOKEN_KEY: secret,
      MOMENTS_TICKET_KEY: secret,
      /** Drive folder IDs (the part after /folders/ in the folder's link). */
      MOMENTS_FOLDER_ROOT: secret,
      MOMENTS_FOLDER_PHOTOS: secret,
      MOMENTS_FOLDER_VIDEOS: secret,
      /** "false" closes uploads without a redeploy of code (change it in Vercel and redeploy). */
      MOMENTS_OPEN: z.enum(['true', 'false']).optional(),
    },
    client: {},
  },
  { strict: isStrictEnv(process.env) },
);

export const isProduction = process.env.NODE_ENV === 'production';
export const momentsOpen = env.MOMENTS_OPEN !== 'false';
