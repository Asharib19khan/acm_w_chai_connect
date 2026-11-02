/* Vitest: one throwaway Postgres for the whole run (workers inherit DATABASE_URL). */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startLocalPostgres } from '../local/postgres';

export default async function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'chai-pg-'));
  rmSync(dir, { recursive: true, force: true });
  const db = await startLocalPostgres({ dir, port: 54339, persistent: false });
  process.env.DATABASE_URL = db.url;
  process.env.QUIZ_SWEEP_MS = '0';
  return async () => {
    await db.stop();
    rmSync(dir, { recursive: true, force: true });
  };
}
