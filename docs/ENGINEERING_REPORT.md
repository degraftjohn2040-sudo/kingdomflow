# Engineering report — 2026-09-19

## Delivery scope

**Foundation and core-operations implementation, not a production-complete release.**

The starting repository contained only a README. No existing application was replaced. Work remains in `degraftjohn2040-sudo/kingdomflow` on the required Arena branch.

## Implemented and locally verified

- Next.js 16.3.5 App Router / React 19 application; strict TypeScript; responsive authenticated workspace shell; accessible public setup/auth forms; explicit configuration/unavailable/error states.
- Three executable PostgreSQL migrations, 18 RLS-protected application tables, tenant-safe composite foreign keys, role permission functions, active-plan checks, guarded organization bootstrap, archival checks, private storage policies, and audit triggers.
- Database create/read/update/archive paths for members; visitor editing and idempotent conversion; attendance recording; department/group/event/follow-up/volunteer persistence. These were exercised against embedded PostgreSQL, including adverse authorization cases.
- Confidential-prayer isolation, restricted contribution records, read-only payment/AI ledgers, and protected subscription/role fields verified in SQL tests.
- Validation, redirect safety, CSV formula protection, configuration endpoint, and fail-closed public routing verified locally.
- Reproducible package lock, environment example, Netlify configuration, GitHub CI definition, and deployment/security runbooks.

## Built, but awaiting hosted end-to-end verification

| Area                 | Source implementation                                                                       | Genuinely unfinished / unverified                                                               |
| -------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Authentication       | Supabase SSR registration, login, logout, confirmation callback, password recovery/update   | Real email delivery, hosted sessions/cookies, production redirects and auth smoke tests         |
| Onboarding           | Atomic organization/profile/owner creation with 30-day trial                                | Hosted flow; logo upload and resumable multi-step onboarding                                    |
| Members              | Add, list/search/filter/page, profile/edit, archive; group/department links                 | Hosted UI CRUD; photos, import, member-directory export                                         |
| Visitors             | Add/edit/list/search, assignment name, follow-up fields, member conversion                  | Hosted flow; deduplication against pre-existing unrelated members; structured worker assignment |
| Attendance           | Session creation, type-specific links, searchable paged roster, present/absent batch upsert | Hosted flow; dedicated history, recurring absentees and date-series trends                      |
| Departments / groups | Create/read/edit/archive, leader names, member relationships                                | Verified leader user assignment, bulk membership tools, department/group analytics              |
| Events               | Create/read/edit/cancel, venue, time, organizer name, capacity                              | Registration/capacity enforcement, calendar view, recurring events                              |
| Follow-ups           | Pipeline status, worker name, contact count, next date, notes                               | Reminder delivery, structured attempt history and worker user assignment                        |
| Prayer / volunteers  | Permission-protected prayer fields; member-linked volunteer records and schedules           | Hosted flows; per-team access/assignments; volunteer service attendance workflow                |
| Contributions        | Restricted GHS manual accounting records                                                    | Hosted flow; receipts, reversals/approval controls; NOT payment processing                      |
| Dashboard            | Permission-aware database counts, recorded attendance ratio, upcoming events                | Hosted data query verification; historical growth charts                                        |
| Reports              | Authorized date-range counts, real CSV serialization/download handler                       | Hosted report/export testing; detailed trends, finance aggregation, PDF                         |
| Settings             | Organization and current administrator profile updates; recent audit view                   | Hosted flow; staff invites/roles/suspension/removal, branding, avatars, workspace switcher      |
| Billing              | Database plan catalog, subscription status, persisted payment history                       | No purchase/renewal mechanism yet; usage limits not implemented                                 |

The ministry module forms use real Supabase operations, not in-memory production stores. Their completeness is deliberately **not** asserted without live end-to-end verification.

## Database

Tables: `plans`, `profiles`, `organizations`, `organization_members`, `members`, `visitors`, `departments`, `groups`, `events`, `attendance_sessions`, `attendance_records`, `followups`, `prayer_requests`, `volunteers`, `contributions`, `audit_logs`, `payments`, `ai_usage`.

Migrations:

1. `202609190001_foundation.sql`: schema, tenant/role/plan functions, RLS, audit/immutability guards, onboarding, conversion.
2. `202609190002_storage_and_billing.sql`: protected provider ledgers and private storage.
3. `202609190003_explicit_privileges.sql`: removal of permissive default grants, protected conversion marker, timezone guard.

Migrations passed in embedded PostgreSQL. **They have not been applied to a hosted Supabase project.**

## Integrations

- Supabase: clients and migrations are wired; **project not connected**.
- Supabase Auth: provider-boundary tests pass; **no live login/registration/logout/reset flow is confirmed**.
- Storage: SQL policies verified in an isolated fixture; **live Storage API and upload UI not enabled**.
- Paystack, manual MoMo approval, WhatsApp, email campaigns, OpenAI: **not implemented/connected**; corresponding pages show unavailable states.
- Payment verification/webhook tests cannot be claimed because the payment processor is not implemented. SQL tests instead verify that users cannot fabricate a verified payment.

## Checks

Final local results:

| Check                                                | Result                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| ESLint                                               | Pass, no warnings                                                  |
| TypeScript / route type generation                   | Pass                                                               |
| SQL + unit tests                                     | **40 passed** (21 database, 10 validation/safety, 9 auth boundary) |
| Chromium browser/API checks against production build | **10 passed**                                                      |
| Automated WCAG A/AA checks                           | Pass on configuration, login, and registration pages               |
| `next build`                                         | Pass                                                               |
| `npm audit --omit=dev`                               | 0 known vulnerabilities                                            |

Test suites cover:

- PostgreSQL migrations, restrictive grants despite permissive defaults, cross-tenant attacks, role checks, member updates/archival, visitor conversion, attendance constraints/author, confidential prayer, finance entitlements, expired trials, audit immutability, protected provider ledgers, private storage, and membership suspension.
- Auth server-action contracts using isolated test doubles; no production mock provider exists.
- Input/schema, redirect and CSV safety.
- Chromium public setup/auth navigation, protected unconfigured routes, mobile horizontal overflow, health/callback error contracts, security headers, and axe WCAG A/AA checks on public pages.

The initial browser install was blocked by the browser CDN/network and missing shared libraries. A temporary npm-distributed Chromium binary and its bundled libraries were used locally; they are not committed. CI uses Playwright's standard browser installation.

## Deployment and configuration

`netlify status`: **Not logged in**. No site is linked. No deployed production URL or successful Netlify adapter build has been verified. Supabase credentials, production auth/SMTP setup, and an authorized Netlify project are required before deployment can be attempted safely. See [DEPLOYMENT.md](DEPLOYMENT.md).

No real secrets or production/sample ministry records were added to the repository.

## Next priority

1. Connect a staging Supabase project; apply/verify all migrations.
2. Configure auth/SMTP and run real authentication, tenant attack, and module UI smoke tests.
3. Finish staff administration, profile/file handling, ministry workflow depth, and usage limits.
4. Implement and test Paystack/webhooks/manual MoMo before accepting any money.
5. Implement provider-confirmed messaging and authorized/metered AI.
6. Authorize Netlify; verify its Next.js runtime, deploy staging, complete production release gates, then promote.
