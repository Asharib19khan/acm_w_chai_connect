/*
 * One-off move from the old local JSON store (.data/dev-db.json) into Postgres: the superadmin and
 * other admins (same authenticator), recovery codes, game station keys, settings, game statuses and
 * quizzes. Demo content (questions, CVs, moments, sessions, audit) is left behind.
 *
 *   DATABASE_URL=... pnpm db:import-local      (needs the same TOTP/SESSION keys as .data/dev-keys.json)
 *
 * Safe to run twice: rows that already exist are skipped.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { closeSql, listGames } from '@chai/db';
import { sql } from '../packages/db/src/sql';

const file = join(process.cwd(), '.data', 'dev-db.json');
if (!existsSync(file)) throw new Error('No .data/dev-db.json to import.');
const old = JSON.parse(readFileSync(file, 'utf8'));

await listGames(); // seeds settings, quiz control and games first
const s = sql();
const counts: Record<string, number> = {};
const add = (k: string, n: number) => (counts[k] = (counts[k] ?? 0) + n);

await s.begin(async (t) => {
  for (const a of old.admins ?? []) {
    const r = await t`insert into admins ${t(a)} on conflict do nothing returning id`;
    add('admins', r.length);
  }
  for (const rc of old.recoveryCodes ?? []) {
    const r = await t`insert into recovery_codes ${t(rc)} on conflict do nothing returning admin_id`;
    add('recovery codes', r.length);
  }
  for (const st of old.gameStations ?? []) {
    const r = await t`insert into game_stations ${t(st)} on conflict do nothing returning id`;
    add('stations', r.length);
  }
  for (const g of old.games ?? []) {
    await t`update games set status = ${g.status}, capacity = ${g.capacity} where id = ${g.id}`;
  }
  if (old.settings) await t`update settings set data = ${t.json(old.settings)} where id = 1`;
  for (const q of old.quizzes ?? []) {
    const r = await t`
      insert into quizzes (id, title, settings, questions, ran_at, created_at)
      values (${q.id}, ${q.title}, ${t.json(q.settings)}, ${t.json(q.questions)}, ${q.ranAt}, ${q.createdAt})
      on conflict do nothing returning id`;
    add('quizzes', r.length);
  }
});

console.log('Imported:', counts);
await closeSql();
