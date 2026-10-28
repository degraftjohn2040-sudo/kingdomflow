# KingdomFlow

**Members. Ministry. Growth. One Platform.**

Multi-tenant church and ministry management for Ghana and beyond — member records, attendance
(including offline and QR), events, departments, giving and expenses, visitor follow-up, reporting,
staff roles and audit history, all scoped to an organization and its branches.

Built with Next.js 15 (App Router), React 19, TypeScript strict, Tailwind CSS and Supabase
(Postgres + Auth + Row Level Security).

---

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase project values
npm run dev                  # http://localhost:3000
```

```bash
npm run typecheck   # tsc --noEmit
npm run build       # production build
npm test            # vitest
```

## Environment

| Variable | Where it is used | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | publishable key; RLS still applies |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | bypasses RLS — never import into client code |
| `NEXT_PUBLIC_APP_URL` | server | used for auth redirects and invitation links |

`.env.local` is git-ignored. `.env.example` contains placeholders only.

---

## How access control works

Three layers, and the database is the one that matters:

1. **Navigation** — `lib/permissions.ts` decides which links render. Cosmetic.
2. **Server** — every page and server action calls `requirePermission(...)` before touching data.
3. **Postgres** — Row Level Security. Every tenant table requires
   `private.has_permission(organization_id, '<key>')` and, for branch-scoped rows,
   `private.has_branch_access(organization_id, branch_id)`.

Roles: owner, admin, senior_pastor, pastor, secretary, finance_officer, department_leader,
followup_officer, viewer. The matrix lives in `public.role_permissions` (data, not code) and is
mirrored in `lib/permissions.ts` for rendering.

Money requires `finance.view`. Pastoral notes require `member.notes.view` and live in
`private.member_pastoral_notes`, reachable only through gated RPCs — never through the REST API,
CSV export, or a broad table grant.

## Database

Migrations live in `supabase/migrations/`. The security model is restored and hardened by
`20261028_tenant_security.sql`.

Executable proofs (self-cleaning, run in the SQL editor):

- `supabase/tests/tenant_isolation.sql` — 30 assertions across two simulated tenants
- `supabase/tests/privilege_escalation.sql` — 6 assertions on role changes and suspension

Both simulate authenticated requests with `request.jwt.claims`, the same way Supabase does.

## Project layout

```
app/
  (auth)/            login, signup, verify, forgot/reset password
  (app)/             the workspace: dashboard, members, attendance, events,
                     departments, branches, giving, visitors, followups,
                     reports, team, audit, settings, platform
  actions/           server actions (all permission-gated)
  api/members/export CSV export route
  auth/              OAuth callback + email confirmation handlers
  checkin/           public-facing self check-in screen
  invite/[token]/    invitation acceptance
components/          UI primitives and client components
lib/                 auth context, permissions, validation, csv, offline queue
supabase/            migrations and database test harnesses
docs/                audit, deployment and security notes
```

## Status

TypeScript clean, production build passing, 45 unit tests passing, tenant-isolation and
privilege-escalation suites passing against the live database. Not yet exercised end-to-end in a
browser or deployed — see [`docs/AUDIT.md`](docs/AUDIT.md) for the precise list of what was and was
not verified, and [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the deployment steps.
