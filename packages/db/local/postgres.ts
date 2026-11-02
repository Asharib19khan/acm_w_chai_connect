/*
 * Local Postgres for development and tests: a real PostgreSQL 17 from the embedded-postgres
 * package (no Docker). The schema comes from supabase/migrations, the same files Supabase runs.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import postgres from 'postgres';

const here = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = join(here, '..', '..', '..', 'supabase', 'migrations');

export async function startLocalPostgres(opts: {
  dir: string;
  port: number;
  persistent: boolean;
}): Promise<{ url: string; stop: () => Promise<void> }> {
  const pg = new EmbeddedPostgres({
    databaseDir: opts.dir,
    user: 'postgres',
    password: 'postgres',
    port: opts.port,
    persistent: opts.persistent,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => {},
    onError: () => {},
  });
  if (!existsSync(join(opts.dir, 'PG_VERSION'))) await pg.initialise();
  await pg.start();
  const admin = postgres(`postgres://postgres:postgres@127.0.0.1:${opts.port}/postgres`, { onnotice: () => {} });
  const exists = await admin`select 1 from pg_database where datname = 'chai'`;
  if (!exists.length) await admin`create database chai encoding 'UTF8' lc_collate 'C' lc_ctype 'C' template template0`;
  await admin.end();
  const url = `postgres://postgres:postgres@127.0.0.1:${opts.port}/chai`;
  await migrate(url);
  return { url, stop: () => pg.stop() };
}

/** Applies supabase/migrations files that haven't run yet, in name order. */
export async function migrate(url: string): Promise<string[]> {
  const sql = postgres(url, { onnotice: () => {}, max: 1 });
  try {
    await sql`create table if not exists _local_migrations (name text primary key, at timestamptz default now())`;
    const done = new Set((await sql`select name from _local_migrations`).map((r) => r.name as string));
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
    const applied: string[] = [];
    for (const file of files) {
      if (done.has(file)) continue;
      const body = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      await sql.begin(async (t) => {
        await t.unsafe(body).simple(); // several statements per file: simple protocol
        await t`insert into _local_migrations (name) values (${file})`;
      });
      applied.push(file);
    }
    // The migration-tracking table is local-only; keep it out of any API too.
    await sql`alter table _local_migrations enable row level security`;
    return applied;
  } finally {
    await sql.end();
  }
}
