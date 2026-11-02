import 'server-only';
import postgres from 'postgres';

/*
 * The one Postgres connection for the server. Production: Supabase through its transaction pooler
 * (DATABASE_URL, port 6543, so prepared statements are off). Local dev and tests: the portable
 * Postgres started by `pnpm db:local` / the test setup, at LOCAL_DATABASE_URL below.
 */

export const LOCAL_DATABASE_URL = 'postgres://postgres:postgres@127.0.0.1:54329/chai';

type Sql = postgres.Sql<Record<string, never>>;
export type Tx = postgres.TransactionSql<Record<string, never>> | Sql;

const g = globalThis as unknown as { __chaiSql?: Sql };

/** "2026-11-02 14:58:31.12+00" (or a zone-less timestamp, read as UTC) → ISO string. */
export function isoFromPg(v: string): string {
  let s = v.replace(' ', 'T');
  if (/[+-]\d\d$/.test(s)) s += ':00';
  else if (!/(Z|[+-]\d\d:?\d\d)$/.test(s)) s += 'Z';
  return new Date(s).toISOString();
}

function connect(): Sql {
  const url = process.env.DATABASE_URL ?? LOCAL_DATABASE_URL;
  if (!process.env.DATABASE_URL && process.env.NODE_ENV === 'production' && process.env.VERCEL) {
    throw new Error('DATABASE_URL is not set.');
  }
  const local = url.includes('127.0.0.1') || url.includes('localhost');
  return postgres(url, {
    prepare: false,
    max: local ? 10 : 5,
    idle_timeout: 20,
    connect_timeout: 15,
    ssl: local ? false : 'require',
    onnotice: () => {},
    // Column names only: keys inside jsonb (e.g. question ids) must stay exactly as stored.
    transform: { column: { from: postgres.toCamel, to: postgres.fromCamel } },
    types: {
      // Timestamps come back as ISO strings, matching the app types.
      isoTime: {
        to: 1184,
        from: [1114, 1184],
        serialize: (v: string | Date) => (v instanceof Date ? v.toISOString() : v),
        parse: (v: string) => isoFromPg(v),
      },
      // bigint and real come back as plain numbers (values here stay far below 2^53).
      int8: { to: 20, from: [20], serialize: (v: number) => String(v), parse: (v: string) => Number(v) },
    },
  }) as unknown as Sql;
}

export function sql(): Sql {
  // The driver carries a pnpm patch (patches/postgres@3.4.9.patch) for Supabase's pooler.
  g.__chaiSql ??= connect();
  return g.__chaiSql;
}

export async function closeSql(): Promise<void> {
  const s = g.__chaiSql;
  g.__chaiSql = undefined;
  await s?.end({ timeout: 5 });
}

const RETRY = new Set(['40001', '40P01']);

/** Runs fn in one transaction. Retries on deadlock/serialization failures. */
export async function tx<T>(fn: (t: postgres.TransactionSql<Record<string, never>>) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return (await sql().begin((t) => fn(t))) as T;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (attempt < 4 && code && RETRY.has(code)) {
        await new Promise((r) => setTimeout(r, 20 + Math.random() * 60 * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }
}

/** Postgres unique-violation, optionally on one named constraint/index. */
export function isUnique(error: unknown, constraint?: string): boolean {
  const e = error as { code?: string; constraint_name?: string };
  return e?.code === '23505' && (!constraint || e.constraint_name === constraint);
}
