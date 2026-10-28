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
};
