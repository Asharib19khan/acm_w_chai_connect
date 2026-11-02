/*
 * `pnpm db:local`: runs the local database for `pnpm dev` (port 54329, data in .data/pg).
 * Leave it running in its own terminal; Ctrl+C stops it cleanly.
 */
import { join } from 'node:path';
import { startLocalPostgres } from './postgres';

const root = join(import.meta.dirname, '..', '..', '..');
const db = await startLocalPostgres({ dir: join(root, '.data', 'pg'), port: 54329, persistent: true });
console.log(`Local database ready at ${db.url}`);

const stop = async () => {
  await db.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
