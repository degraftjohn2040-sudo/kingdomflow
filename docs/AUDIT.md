# KingdomFlow — audit and implementation record

Date: 2026-10-28 · Branch: `arena/f753a212-kingdomflow` · Supabase project: `ivglimtjzcdfyflscngh`

This document records what was actually found, what was changed, and what was verified.
Nothing here is forward-looking unless it is under **Remaining work / blockers**.

---

## 1. Resources found and verified

| Resource | Identifier | State found | Verified how |
| --- | --- | --- | --- |
| GitHub repository | `degraftjohn2040-sudo/kingdomflow` | One commit (`ea112f2 Initial commit`) holding a two-line pasted README. No application code. | `git log`, `gh repo list` |
| Supabase project | `ivglimtjzcdfyflscngh` (KingdomFlow, eu-central-1, Postgres 17.6.1) | 32 tables, 67 policies, 63 functions, 19 migrations. **0 organizations, 0 members, 0 giving records.** 3 plans seeded. 5 auth users. | MCP SQL queries (catalog, counts, `pg_policies`, `pg_proc`) |
| Second Supabase project | `StudyPilot AI` | Unrelated. Not touched. | `list_projects` |
| Vercel project | `kingdomflow` (team `NFhkq…`, Next.js preset) | **Zero deployments.** Environment variables already set for the correct Supabase project (`NEXT_PUBLIC_SUPABASE_URL`, anon key, service-role key) targeting production/preview/development. Git integration disabled. | `list_projects` |
| Zite app | `kingdomflow.zite.so` | Pre-existing hosted app, separate from this repository and this Supabase project. **Deliberately not modified.** | user-provided reference only |
| Google Drive / Docs / Gmail / Linear / Calendar / Sheets / Slides / Discord | — | Not queried. No KingdomFlow material was identified as being needed, and the brief forbids browsing unrelated personal correspondence. | — |

The database is empty of tenant data, so the schema work below could be done without risking
anybody's records. **No table was dropped and no existing row was deleted.**

---

## 2. Architecture in use

- **Application** — Next.js 15.5 App Router, React 19, TypeScript strict, Tailwind 3.4,
  Zod validation, server actions, `@supabase/ssr` cookie sessions. No client-side data fetching
  for anything authoritative.
- **Data** — Supabase Postgres with Row Level Security as the security boundary,
  `SECURITY DEFINER` functions for every multi-step mutation, audit logging inside those functions.
- **Secrets** — service-role key server-only; `.env.example` holds placeholders;
  `.env.local` is git-ignored.
- **Deployment** — Vercel (project exists, not yet deployed).

---

## 3. Defects found

### 3.1 Broken security layer (critical, fixed)

The two `2026-10-28` migrations (`full_cleanup`, `create_all_tables`) rebuilt `public` from scratch.
They replaced the schema but left the previous `SECURITY DEFINER`/RLS layer in place. The result was
a database whose policy functions referenced objects that no longer existed:

- `public.organization_members` (the code expects `organization_memberships`)
- missing `public.role_permissions`, `public.subscriptions`, `public.plans`,
  `public.organization_invitations`, `public.event_registrations`
- `public.giving_records` / `follow_ups` / `follow_up_notes` instead of the expected names
- `members.notes` holding pastoral notes in a table every member could read

Consequences: `has_permission()`, `is_org_member()`, `has_feature()` and every gated RPC would
either error or silently deny. The application could not have worked against it.

**Fix** — reconciled the schema back to the contract the security layer expects
(`supabase/migrations/20261028_tenant_security.sql`), rather than deleting the security layer.

### 3.2 Unverified privilege-escalation vectors (tested, all blocked)

Tested with real JWT claims inside Postgres (`supabase/tests/`):

| Attempt | Result |
| --- | --- |
| Read another tenant's members / organizations / attendance / giving | 0 rows (RLS) |
| Read another tenant's pastoral notes | denied (schema not exposed) |
| Insert a member into another tenant | denied (`42501`) |
| Self-join another organization by inserting a membership row | denied |
| Self-promote role (`viewer` → `admin`) | no rows affected |
| Admin granting `owner` to another user, or promoting themselves | denied by trigger |
| Inviting someone as `owner`, or above the inviter's own permissions | denied |
| Demoting the last remaining owner | denied |
| Suspended staff retaining access | no rows |
| Self-assign `profiles.is_platform_admin` | denied by trigger |
| Viewer reading audit log / finance / invitations | no rows |
| Cross-tenant QR validation | denied |

### 3.3 Residual issues (not fixed, deliberately)

- `audit_logs.ip_address` and `user_id` are still `NOT NULL`, so a service-role insert without an
  actor must supply a value. Low impact: app inserts always come through RPCs with `auth.uid()`.
- `public.invitations` is an orphan from the baseline (RLS enabled, zero policies). It is unused;
  invitations use `organization_invitations`. Removing it is a follow-up with no behaviour change.
- `plans` carries both `features text[]` and `marketing_features jsonb`; both are populated and used.
- `attendance_sessions.qr_token` still exists alongside the newer `qr_secret_hash`. It is no longer
  written (QR minting sets it to `NULL`) and is kept for backward compatibility only.

---

## 4. What was built

### 4.1 Database (applied to the live project)

- Renamed tables back to the contract; added the missing columns the RPCs read.
- `role_permissions` — a 9-role × 38-permission matrix as data, seeded and queryable.
- Restored `subscriptions`, `organization_invitations` (SHA-256 hashed tokens), `event_registrations`.
- Moved pastoral notes out of `public.members` into `private.member_pastoral_notes`, reachable only
  through permission-gated RPCs.
- One uniform policy shape for 18 tenant tables: `private.has_permission(org, key)` plus
  `private.has_branch_access(org, branch)` — a branch-scoped leader cannot see another branch.
- Guard triggers: last-owner protection, self-role-change protection, ownership-grant protection,
  platform-admin self-assignment protection.
- RPCs: `create_workspace`, `accept_invitation`, `my_permissions`, `invite_staff`,
  `revoke_invitation`, `change_membership`, `workspace_summary`, `record_attendance`,
  `start_qr_checkin`, `qr_session_status`, `self_check_in`, `set_pastoral_note`,
  `get_pastoral_note`, `archive_member`, `convert_visitor`, `register_event`,
  `recurring_absentees`, `am_i_platform_admin`, `platform_overview`.
- Column-level grants so `qr_secret_hash` and provider API keys are never selectable by a client.

### 4.2 Application

33 routes under `app/`: landing, auth (login, signup, verify, forgot/reset password,
`/auth/callback`, `/auth/confirm`), onboarding, `/invite/[token]`, and the workspace:
dashboard, members (list / new / detail / edit / CSV import / export), attendance (sessions,
roster, QR panel, `/checkin`), events, departments, branches, giving & expenses, visitors,
follow-ups, reports, team, audit log, settings, platform admin.

Highlights:

- **Permission-aware navigation and server-side gates** — every page and every server action calls
  `requirePermission()`, and RLS independently enforces the same rule.
- **Member records are separate from logins** (`members.linked_user_id`); no accounts are created
  for recorded members.
- **CSV import** with header mapping (synonyms: `SURNAME`, `Mobile Phone`, `Town`, …), per-row
  validation and duplicate detection by email / phone / name, before anything is written.
- **Offline attendance** — IndexedDB queue, `client_ref` idempotency, a record only leaves the
  queue when the server confirms it, visible pending/synced state.
- **QR check-in** — session-scoped secret, hashed at rest, expiring, invalidated on re-mint;
  a bare member id is never trusted. Self check-in only works for a member linked to the login.
- **Finance is gated** — `finance.view` / `finance.manage`; dashboard totals return `null` for
  roles without it, and the UI shows nothing in their place.

---

## 5. Verification performed

| Check | Command / method | Result |
| --- | --- | --- |
| TypeScript | `npx tsc --noEmit` | clean |
| Production build | `npm run build` | success, 33 routes |
| Unit tests | `npx vitest run` | **45 passed / 45** (6 files: permissions, CSV, offline queue, validation, formatting, utils) |
| Tenant isolation | `supabase/tests/tenant_isolation.sql` on the live project | 30 assertions |
| Privilege escalation | `supabase/tests/privilege_escalation.sql` on the live project | 6 assertions, all pass |
| Runtime smoke | `next dev` + `curl` | `/` 200, `/login` 200, `/signup` 200, `/dashboard` → 307 to login |

### What could **not** be verified, and why

**The sandbox has no network route to `*.supabase.co`** (`ECONNRESET` on TLS; only GitHub, npm and
PyPI are reachable). Therefore:

- The database was driven through the Supabase management API (SQL), not through the app's HTTP
  client. RLS was exercised by simulating JWT claims inside Postgres — the same mechanism Supabase's
  own test suite uses — rather than by signing in through the UI.
- A browser session against the live database has **not** been exercised end-to-end.
- `scripts/verify.mjs` (a two-tenant E2E over the REST API) is written but **cannot run here**.
  It created no data.

**Vercel deployment is not done.** The project exists with correct environment variables, but the
connector offers no way to link the GitHub repository, and the sandbox cannot reach
`api.vercel.com`. There are zero deployments on the project, so nothing was replaced.

---

## 6. Remaining work / blockers

1. **Link the repository to the Vercel project and deploy** — then set the auth redirect URLs
   (`https://<domain>/auth/callback`, `/auth/confirm`, `/reset-password`) in Supabase Auth, which
   still points at `zite.so`.
2. **First real browser run** against the deployed URL: create a workspace, import a CSV, take
   attendance offline and sync, mint and scan a QR code.
3. **Invitation delivery** — the token is generated and stored, but no mail provider is wired up.
   Until one is (Resend/Postmark/Supabase SMTP), the invite screen must copy the link manually,
   which it does.
4. **Google sign-in** — the provider is enabled in Supabase Auth but no credentials were verified
   in this session, so the UI does not offer it.
5. **Recurring events** — `recurrence_rule` is stored and displayed, but the expansion engine is
   not built; occurrences are not generated.
6. **Google Calendar sync per tenant** — not built. It must use per-tenant OAuth, never a shared
   developer calendar.
7. **SMS / WhatsApp / email campaigns** — tables and settings exist; providers are not configured.
8. **Storage** — no buckets are defined yet, so member photos are not uploadable.
