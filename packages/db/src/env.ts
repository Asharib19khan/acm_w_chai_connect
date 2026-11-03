// Server keys the data layer needs. Apps validate the full set in their own env.ts at build time.
export const dbEnv = {
  IP_HASH_KEY: process.env.IP_HASH_KEY,
  DEVICE_TOKEN_KEY: process.env.DEVICE_TOKEN_KEY,
  TOTP_ENCRYPTION_KEY: process.env.TOTP_ENCRYPTION_KEY,
  SESSION_HMAC_KEY: process.env.SESSION_HMAC_KEY,
  SUPERADMIN_EMAIL: process.env.SUPERADMIN_EMAIL ?? 'asharib2khan@gmail.com',
  isProduction: process.env.NODE_ENV === 'production',
  /** Tests point the dev store at a throwaway folder. */
  dataDir: process.env.CHAI_DATA_DIR,
  /** Supabase Postgres (transaction pooler). Unset locally: the embedded dev database is used. */
  DATABASE_URL: process.env.DATABASE_URL,
  onVercel: Boolean(process.env.VERCEL),
  /** How often the quiz's offline sweep may run (tests set 0). */
  QUIZ_SWEEP_MS: process.env.QUIZ_SWEEP_MS,
  GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  GOOGLE_DRIVE_REFRESH_TOKEN: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
  CV_FOLDER_ID: process.env.CV_FOLDER_ID,
  MOMENTS_FOLDER_ROOT: process.env.MOMENTS_FOLDER_ROOT,
  MOMENTS_FOLDER_PHOTOS: process.env.MOMENTS_FOLDER_PHOTOS,
  MOMENTS_FOLDER_VIDEOS: process.env.MOMENTS_FOLDER_VIDEOS,
};
