/*
 * LOCAL DEVELOPMENT ONLY: prints the current authenticator code for an admin in the local database,
 * so automated browser tests can sign in. It reads .data/ on this machine and cannot reach production.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createDecipheriv } from 'node:crypto';
import postgres from 'postgres';
import { timeStep, totpAt } from '@chai/core/totp';

if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV) {
  throw new Error('dev-code is for local development only.');
}
const email = (process.argv[2] ?? 'asharib2khan@gmail.com').toLowerCase();
const dir = join(process.cwd(), '.data');
// Always the local database: this script never reads DATABASE_URL.
const pg = postgres('postgres://postgres:postgres@127.0.0.1:54329/chai', { max: 1 });
const [admin] = await pg<{ totpSecretEnc: string }[]>`
  select totp_secret_enc as "totpSecretEnc" from admins where email = ${email}`;
await pg.end();
const keys = JSON.parse(readFileSync(join(dir, 'dev-keys.json'), 'utf8')) as Record<string, string>;
if (!admin) throw new Error(`No admin ${email} in the local database.`);
const [iv, tag, data] = admin.totpSecretEnc.split('.').map((p) => Buffer.from(p, 'base64'));
const decipher = createDecipheriv(
  'aes-256-gcm',
  Buffer.from(keys.TOTP_ENCRYPTION_KEY!, 'base64'),
  iv!,
);
decipher.setAuthTag(tag!);
const secret = Buffer.concat([decipher.update(data!), decipher.final()]).toString('utf8');
const step = timeStep();
const offset = process.argv[3] === 'next' ? 1 : 0;
console.log(totpAt(secret, step + offset));
