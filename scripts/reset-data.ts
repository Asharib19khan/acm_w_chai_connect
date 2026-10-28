/* Wipes the local dev store (keeps admins out too). Run: pnpm data:reset */
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { resetStore } from '@chai/db';

rmSync(join(process.cwd(), '.data', 'files'), { recursive: true, force: true });
await resetStore();
console.log('Local data wiped. Run pnpm bootstrap:superadmin to create the superadmin again.');
