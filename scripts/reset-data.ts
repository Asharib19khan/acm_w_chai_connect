/* Wipes the LOCAL database (admins too). Run: pnpm data:reset. Refuses to touch a remote database. */
if (process.env.DATABASE_URL && !/127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL)) {
  throw new Error('data:reset only runs against the local database.');
}
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { resetStore, closeSql } from '@chai/db';

rmSync(join(process.cwd(), '.data', 'files'), { recursive: true, force: true });
await resetStore();
console.log('Local data wiped. Run pnpm bootstrap:superadmin to create the superadmin again.');
await closeSql();
