# Chai Connect

Web platform for **ACM-W Chai Connect**, FAST-NUCES Karachi, 27 November 2026.

Four separate sites:

- `apps/web` (:3000): student site (ask a question, CV, game registration, quiz). No menu, no scores.
- `apps/control` (:3001): auditorium display (`/`) and admin portal (`/admin`)
- `apps/moments` (:3002): Share Moments, photo upload straight to our Drive
- `apps/desk` (:3003): games desk for web team members (registrations, check-in, scores). Members
  can never sign in to the admin portal.
- `packages/*`: shared UI, logic, database and moderation code
- Spec: [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md) (section 0 overrides the rest). Repo rules: [`CLAUDE.md`](CLAUDE.md).

Everything runs on free tiers.

## Getting started

Requirements: Node 22.12+ (24 recommended), pnpm 10, and Docker Desktop for the local database.

```sh
pnpm install
pnpm dev            # all four sites on http://localhost:3000-3003
```

Environment variables are optional locally. Copy `.env.example` to `apps/web/.env.local` and
`apps/control/.env.local` as each service gets set up. Never commit those files. On Vercel, production
and preview builds fail if any variable is missing or a secret carries a `NEXT_PUBLIC_` prefix.

## Data

Production data lives in Supabase Postgres (free tier, Mumbai). The schema is in
`supabase/migrations`; apply new files with `pnpm exec supabase db push`. Every new table must
enable RLS and revoke `anon`/`authenticated`, as the first migration does: only our servers query
tables, through `packages/db`.

Locally, `pnpm dev` also starts a real PostgreSQL 17 (embedded-postgres, no Docker) on port 54329,
with its data in `.data/pg` (never committed). Tests start their own throwaway copy. Typical first run:

```sh
pnpm bootstrap:superadmin   # creates the superadmin; scan the QR with Microsoft Authenticator
pnpm seed:demo              # optional: synthetic questions, CVs, registrations and a quiz
pnpm dev
```

Scripts that touch data need the local database running (`pnpm db:local` in its own terminal, or
`pnpm dev`).

- Student site: http://localhost:3000
- Auditorium display: http://localhost:3001 (press Ctrl+Shift+1+9 to sign in)
- Admin portal: http://localhost:3001/admin (add web team members on the Team page)
- Share Moments: http://localhost:3002 · Games desk: http://localhost:3003
- `pnpm data:reset` wipes the local database (run `bootstrap:superadmin` again afterwards).

## Checks

```sh
pnpm lint           # ESLint, including the security rules from CLAUDE.md
pnpm typecheck
pnpm test           # Vitest, including the data rules against a real Postgres
pnpm test:db        # pgTAP database tests (needs Docker: run `pnpm exec supabase start` first)
pnpm e2e            # Playwright on iPhone, Pixel and 1920x1080 sizes (first run: pnpm exec playwright install chromium webkit)
pnpm format         # Prettier
```

CI runs all of these on every pull request, plus a gitleaks secret scan and CodeQL.

## Secrets

Secrets live only in Vercel's environment settings and a password manager, never in git. The
pre-commit hook runs [gitleaks](https://github.com/gitleaks/gitleaks) when it is installed.

GitHub Actions secrets used by the scheduled jobs (add them once Supabase exists):

| Secret                                 | Used by                                                       |
| -------------------------------------- | ------------------------------------------------------------- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`    | Daily keep-alive ping (free projects pause after 7 idle days) |
| `SUPABASE_DB_URL`, `BACKUP_PASSPHRASE` | Nightly encrypted database backup                             |

---

Built by the ACM-W Web Team · (ASHARIB)
