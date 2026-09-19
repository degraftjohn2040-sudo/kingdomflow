# Security model and release gates

## Enforced in the database

- Every ministry-owned operational row has a non-null `organization_id` with a foreign key. Global plan definitions and self-owned profiles are the deliberate exceptions.
- Every application table has RLS. Active membership is required; suspended membership is excluded at query time.
- `private.has_permission` is the single role-to-permission map. Server actions call its public invoker wrapper, and RLS repeats authorization independently.
- Owner/admin permissions are explicit allowlists, not a wildcard that automatically grants future sensitive capabilities.
- Department/group leaders currently have organization-wide read and attendance permissions listed in the SQL map. **Assignment-scoped leadership permissions are not implemented.** Review this role contract before assigning those roles.
- Organization bootstrap derives identity from `auth.uid()`, requires verified email, takes an advisory transaction lock, creates owner membership atomically, and refuses a second bootstrap for an existing member.
- Composite `(id, organization_id)` foreign keys reject cross-tenant member/group/event/session/visitor links even if an attacker knows a UUID.
- UPDATE guards prevent tenant, primary-key, or creation timestamp changes. Attendance author IDs are overwritten with `auth.uid()`.
- Visitor conversion locks the source row and is idempotent. Its narrowly scoped definer function checks both permissions and an active entitlement; only that function can write the conversion marker.
- No authenticated user can directly create organization memberships, change roles, alter subscription fields, fabricate payments, write AI usage, or edit/delete audit logs.
- Sensitive prayer requests require both `prayer.read` and `prayer.confidential` when visibility is leadership-only.
- Contribution reads/writes require finance permission and active finance entitlement. Operational writes require an active core entitlement. Expired accounts retain authorized non-finance history access.
- Archive, not physical deletion, is used for members/departments/groups/volunteers. Member archival requires `members.delete` in both application and database checks.
- Audit triggers record actor, tenant, resource, operation, and time. They deliberately omit field values to avoid copying prayer details, contact data, or financial notes into a secondary log. This is not a full before/after history system.
- The third migration explicitly revokes Supabase's potentially permissive default table/function grants before applying least privilege. Tests reproduce permissive defaults.

## Application boundaries

- SSR uses the public Supabase key and verified `auth.getUser()` identity, never a browser-submitted user ID.
- An organization cookie is only a preference: its value must match an active membership returned under RLS. It does not grant access.
- All writable record fields are allowlisted by module and validated through strict Zod schemas on the server. Client validation improves usability but is not a security boundary.
- List queries are paginated; linked-option queries are capped at 200; attendance rosters at 50 and batch writes at 100.
- Search input strips PostgREST expression syntax. No raw user SQL is constructed in production code.
- Callback destinations are fixed internal routes or validated `/app` paths, based on a configured canonical origin rather than an arbitrary request host.
- Auth failures and provider errors cannot set an authenticated state locally. Logout calls Supabase first and only redirects on success.
- Next.js Server Actions provide same-origin/Origin validation. No permissive server-action origin wildcard is configured.
- Private workspace responses are dynamic and the session proxy sets `private, no-store`. Report exports are no-store and permission/entitlement gated.
- React escapes rendered text; no user HTML is inserted. CSP, nosniff, referrer policy, permissions policy, production HSTS, and production frame denial are configured. CSP still permits inline Next.js scripts/styles; a nonce-based stricter CSP remains a hardening task.
- Development permits Arena iframe previews. Production denies framing.
- CSV serialization quotes cells, doubles embedded quotes, and neutralizes formula prefixes.
- Provider-only secrets are not used or imported by any core production module. No service-role client exists in the normal application request path.

## Storage

The private `organization-files` bucket is administrator-only, scoped by organization ID in the object path, size-limited, and MIME-allowlisted. There is no object UPDATE policy, so clients cannot move objects across tenants. Upload UI and signed URL workflows remain unavailable. MIME declarations are not malware scanning; sensitive file workflows must add content checks and a retention policy before being enabled.

## Test boundary

PGlite executes PostgreSQL RLS, constraints, grants, triggers, and functions. Tests define minimal `auth.users`, `auth.uid()`, `storage.buckets`, and `storage.objects` fixtures. Auth server actions use test doubles strictly in unit tests. This validates policy behavior and provider-call contracts, not Supabase's hosted HTTP/auth/storage services or production credentials.

## Remaining security / operational release gates

- Real Supabase REST/SSR/session/email/storage testing and deployed-site smoke tests.
- Generated Supabase database TypeScript types and schema drift checks.
- Staff invitations, secure role administration, owner transfer/last-owner invariants, and member profile mapping.
- Assignment-scoped leader permissions if required by the ministry's privacy model.
- Public signup abuse controls, provider throttling, application mutation rate limits, and usage caps.
- Nonce-based CSP, security monitoring, structured redacted server logging, alerting, backup/restore tests, data retention, and incident procedures.
- Secure Paystack reference/amount/currency validation, HMAC webhook verification, idempotency, and transactional renewal before payments are enabled.
- Platform-admin authorization and private proof handling before manual MoMo approval.
- AI tool allowlists, authorization, data minimization, quota enforcement, and metering before AI is enabled.
- WhatsApp opt-in/template rules, provider confirmation, delivery callbacks, and retries before communications are enabled.
- Authenticated-page accessibility/manual keyboard review and independent penetration testing before handling real ministry data.
