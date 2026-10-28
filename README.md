# Chai Connect

Web platform for **ACM-W Chai Connect**, FAST-NUCES Karachi, 25 November 2026.

- `apps/web`: student site (ask a question, CV, game registration, quiz, Share Moments, game screens)
- `apps/control`: auditorium display (`/`), admin portal (`/admin`), registrations portal (`/registrations`)
- `packages/*`: shared UI, logic, database and moderation code
- Spec: [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md) (section 0 overrides the rest). Repo rules: [`CLAUDE.md`](CLAUDE.md).

Everything runs on free tiers.

## Getting started

Requirements: Node 22.12+ (24 recommended), pnpm 10, and Docker Desktop for the local database.

```sh
pnpm install
pnpm dev            # student site on http://localhost:3000, control app on http://localhost:3001
```

Environment variables are optional locally. Copy `.env.example` to `apps/web/.env.local` and
`apps/control/.env.local` as each service gets set up. Never commit those files. On Vercel, production
and preview builds fail if any variable is missing or a secret carries a `NEXT_PUBLIC_` prefix.

## Local data (until Supabase is connected)

Both apps share a local store in `.data/` (never committed). Typical first run:

```sh
pnpm bootstrap:superadmin   # creates the superadmin; scan the QR with Microsoft Authenticator
pnpm seed:demo              # optional: synthetic questions, CVs, registrations and a quiz
pnpm dev
```

- Student site: http://localhost:3000
- Auditorium display: http://localhost:3001 (press Ctrl+Shift+1+9 to sign in)
- Admin portal: http://localhost:3001/admin · Registrations: http://localhost:3001/registrations
- `pnpm data:reset` wipes everything (run `bootstrap:superadmin` again afterwards).

## Checks

```sh
pnpm lint           # ESLint, including the security rules from CLAUDE.md
pnpm typecheck
pnpm test           # Vitest unit tests
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
