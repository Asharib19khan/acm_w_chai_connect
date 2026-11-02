# CLAUDE.md — Chai Connect

Event platform for **ACM-W Chai Connect**, FAST-NUCES Karachi, **27 November 2026**.
The full spec is `docs/BLUEPRINT.md`. Before any task, read the blueprint section(s) named in the
prompt. **Blueprint section 0 (Amendments) overrides every later section.** If the blueprint and
this file disagree, stop and ask.

**Free tiers only.** Nothing is bought. Never propose a paid plan as a fix.

## Workflow

- Start every task in plan mode. List the files you will create or change before writing code.
- One phase prompt per branch. Small commits. Open a PR at the end; never push to `main`.
- If the spec is unclear, ask. Do not invent product behaviour.
- If a decision changes the spec, say so and update `docs/BLUEPRINT.md` in the same PR.
- Done = the blueprint's definition of done (section 15): acceptance criteria met, tests green,
  works at phone sizes, loading/empty/error states, axe clean, admin actions audited.

## Stack

- Next.js 16 (App Router, React 19, TypeScript strict). `proxy.ts`, not `middleware.ts`.
- Tailwind CSS v4, shadcn/ui restyled to our tokens, Motion for animation.
- pnpm workspaces + Turborepo. Node 22.12+ (Vitest 5 needs it; CI uses Node 24).
- Supabase Free (one project; local Supabase for dev/tests): Postgres with RLS, Realtime, pg_cron,
  Storage for small covers only. Migrations via Supabase CLI only.
- Upstash Redis (rate limits, quiz heartbeats). Cloudflare Turnstile (bot check).
- Moderation: no API key. `tools/moderator` runs on Ye's laptop and calls Claude Code headless
  (`claude -p`, haiku for questions/photos, sonnet for CVs) with every tool disabled. Prompts and
  schema live in `packages/ai`.
- Files: Google Drive (CVs via our server, photos via `workers/upload-relay`, a Cloudflare Worker).
- `otplib` + `qrcode` for admin TOTP (Microsoft Authenticator). Zod everywhere.
- Tests: Vitest, pgTAP (`supabase test db`), Playwright, axe, k6, OWASP ZAP, Semgrep, CodeQL.

## Layout

```
apps/web        student site (no menu, no scores), /play/<game>          :3000
apps/control    "/" auditorium display, /admin portal                     :3001
apps/moments    Share Moments photo upload site                           :3002
apps/desk       games desk for web team members (registrations, check-in) :3003
                + game-station API /api/games/<slug>/{registrations,scores} (amendment A8)
packages/ui     tokens.css, marquee, components, motion presets
packages/core   zod schemas, roll-number rules, scoring functions, constants
packages/db     generated types, typed queries, server-only Supabase clients
packages/ai     moderation prompts, output schema, rule checks, evals
workers/upload-relay   Cloudflare Worker: phone → Drive photo relay
tools/moderator        laptop worker that runs Claude Code headless
supabase/       migrations, seed.sql, tests (pgTAP)
e2e/  load/  docs/
```

## Commands

```
pnpm dev                 # all four sites
pnpm build
pnpm lint && pnpm typecheck
pnpm test                # vitest
pnpm test:db             # supabase test db (pgTAP)
pnpm e2e                 # playwright
pnpm eval:moderation     # moderation eval set
pnpm moderator           # laptop moderation worker
pnpm bootstrap:superadmin
k6 run load/quiz.js
```

## Security rules (never break these)

1. Secrets live only in environment variables. Never prefix a secret with `NEXT_PUBLIC_`.
   Modules that touch secrets import `server-only`. Never log secrets, TOTP codes or CV contents.
2. The Supabase service-role key is used only inside `packages/db`. Browsers never query tables;
   they may only subscribe to Realtime on `display_events` and upload photos through the relay with a
   server-issued ticket. Students never see a Drive URL, folder or session link.
3. Every new table: RLS enabled, no grants to `anon`/`authenticated` (except `select` on
   `display_events`), plus a pgTAP test proving it.
4. Every server action and route handler, in this order: Zod-parse input → Turnstile (public forms)
   → Upstash rate limit → `requireAdmin(role)` for admin code. Never rely on `proxy.ts` for access control.
5. No `dangerouslySetInnerHTML`. User text is always rendered as text.
6. Moderated items (questions, CVs, uploads) are never hard-deleted: status `removed`, restorable.
7. Points change only by inserting into `score_events`; mistakes are voided, never edited.
8. Every admin action writes `audit_log`.
9. Claude only flags (green/red + reason). Claude never approves or removes anything.
   The moderator worker never enables Claude Code tools and never holds the service-role key.
   Submission text goes inside `<submission>` tags and is treated as data.
10. Quiz: correct options never reach the client before the quiz phase is `ended`.
    All timing is measured on the server.
11. Store HMAC hashes of IPs and device IDs, never raw IPs.
12. CSP with per-request nonces and the security headers from blueprint section 14 on every response.
13. Campus Wi-Fi puts hundreds of students behind one IP: per-IP limits stay high; per-device limits do the work.

## Domain rules (quick reference)

- Roll number stored as `25K-5570`; regex `^[0-9]{2}K-[0-9]{4}$`; accept `25k5570`, `25K 5570`, `25k-5570`.
- Departments: AF, AI, BA, BBA, CE, CS, CY, DS, EE, FT, SE, GRAD (seeded, editable).
- Registration: max 1 physical + 1 mini game per roll number, enforced by the unique index
  `(roll_no, category) where status <> 'withdrawn'`.
- Questions: one per device (`unique(device_hash)`), optional display name.
- One CV per roll number; PDF only, 4 MB, 3 pages; sent to our server, checked in memory, then to Drive.
- Quiz score per question: `P = c · B · (1/2 + 1/2 · (1 − t/T))`, B = 1000 by default.
  Ties: more correct, then lower total time on correct answers, then earlier join.
- Admin login: Ctrl+Shift+1+9 (by `event.code`) or a 3 s long-press on the logo opens the box;
  email + 6-digit TOTP; no passwords. `/admin` returns 404 without a session.
- Games desk login: visible email + TOTP form. Role `member` works on the desk only; sessions are
  tied to the site that created them. Never let a member session reach `apps/control`.
- Students never see scores, points or ranks (only the display shows winners).

## Design rules

- Light theme (amendment A6). Colours only through ROLE tokens from `packages/ui/tokens.css`, never
  raw hex elsewhere: `bg-canvas` (Petal tint page) · `bg-surface` (white cards) · `text-fg` (Ink) ·
  `text-fg-muted` / `text-fg-subtle` · `border-line` · `ring-edge` / `ring-edge-strong` (Grape) ·
  `bg-brand text-on-brand` (Prussian + Petal: primary buttons, strip) · `bg-accent` (Plum fill) ·
  `text-accent-strong` (deep Plum, the only Plum-ish text) · `ok` / `danger` (+ `-soft` fills).
- Plum is never text on the light canvas; use `text-accent-strong`.
- Fonts: Unbounded (display), DM Sans (body), JetBrains Mono (roll numbers, timers, scores).
- Animate only `transform` and `opacity`; respect `prefers-reduced-motion`.
- Mobile-first, 44 px tap targets, WCAG 2.2 AA. Every page has loading, empty and error states.
- Server Components by default; `'use client'` only where interaction needs it.

## Code style

- TypeScript strict, no `any`. Named exports. Small components.
- Shared schemas and pure logic (scoring, validation) live in `packages/core` with unit tests.
- Supabase types are generated, never hand-written.

<!-- (ASHARIB) -->
