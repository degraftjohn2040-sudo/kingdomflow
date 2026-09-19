# Deployment runbook

## Current deployment status

No production deployment has been made. `netlify status` reports **Not logged in**. No Supabase project values are available in this environment. No production URL has been verified. GitHub connectivity does not imply Netlify or Supabase authorization.

Do not send secret keys in chat or commit them. Use the provider consoles and the deployment platform's secure environment configuration.

## 1. Provision Supabase

Use a new development/staging project first. If an existing project is used, audit its schema, grants, and policies before applying migrations. Never apply these migrations blindly to an unrelated production database.

From an authenticated operator environment:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
```

Alternatively apply each SQL file in `supabase/migrations` in filename order through the Supabase SQL editor. All three are required; the third explicitly removes potentially permissive Supabase default grants.

Run `supabase/verify.sql`. Confirm:

- All 18 application tables have RLS enabled.
- No legacy permissive policies bypass tenant membership.
- The six privilege probes return false.
- The `organization-files` bucket is private and limited to 5 MiB and approved MIME types.
- The plan catalog contains trial (30 days), Pro (GHS 150 / 1 month), and Premium AI (GHS 500 / 3 months).
- Database and Auth backups, retention, and provider security advisories are reviewed before launch.

Only `public`, `storage`, and Supabase's normal API schemas should be exposed. Never expose the `private` schema via PostgREST. Never disable RLS. Do not use the service-role key in browser code or normal server actions.

The checked-in `supabase/config.toml` is for local Supabase development and requires Docker. Docker is not available in this Arena environment; hosted/local Supabase service tests have not been run.

## 2. Configure authentication

In Supabase Authentication:

1. Enable email/password sign-in and email verification.
2. Set **Site URL** to your canonical HTTPS application origin.
3. Allow the exact production callback URL `https://YOUR_DOMAIN/auth/callback` and the recovery variant `https://YOUR_DOMAIN/auth/callback?next=/update-password`.
4. Add localhost and exact staging callbacks only where needed; avoid broad wildcard production redirect rules.
5. Configure a verified custom SMTP sender, rate limits, and anti-abuse controls appropriate for public registration.
6. Review session duration, compromised password protection, and incident/revocation procedures.

The application uses Supabase's PKCE code callback flow. If customizing email templates to use token hashes for cross-device links, point signup/email links to:

```text
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email
```

For password recovery use `type=recovery`. The handler accepts only the known email/signup/recovery verification types and fixed internal destinations. Test both the normal same-browser PKCE flow and any customized cross-device email template before release.

## 3. Configure the application

Required for this release:

| Variable                        | Exposure | Purpose                                    |
| ------------------------------- | -------- | ------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | Public   | Your Supabase HTTPS project endpoint       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public   | Anon/publishable key; never service-role   |
| `NEXT_PUBLIC_APP_URL`           | Public   | Canonical HTTPS origin for email callbacks |

Set public variables **before building**; Next.js can inline them. Rebuild after changing them. Local development permits `http://localhost:3000` or `http://127.0.0.1:3000` as the app origin; production requires HTTPS.

The example file reserves server-only integration names. This release does **not** require `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `PAYSTACK_SECRET_KEY`, or `WHATSAPP_ACCESS_TOKEN`. Leave them unset until those integrations are actually implemented and audited. Do not connect live webhooks to nonexistent routes.

## 4. Connect Netlify

An authorized operator must connect the existing GitHub repository to the intended Netlify site, or authorize Netlify in the execution environment. This session must push only `arena/01a0bae7-kingdomflow`; branch promotion is an operator/review decision outside this session.

- Framework: Next.js (automatic Netlify Next.js runtime / OpenNext adapter).
- Node: 22.
- Build: `npm run build`.
- Publish: `.next`.
- Use the supplied `netlify.toml`; do not add an SPA catch-all redirect.
- Configure the three required public environment variables for **build and functions/runtime**, separately for staging and production.
- Use a separate Supabase project for staging when possible.
- Do not share production sessions or credentials with arbitrary deploy previews.

Before promotion, verify Netlify's runtime supports the pinned Next.js 16 version. The local Next.js build passes; Netlify adapter compatibility cannot be claimed until its build and SSR endpoints succeed on a real site.

After an operator authorizes and links the correct site:

```bash
npx netlify status
npx netlify build
# Review site, environment, and production intent before proceeding:
npx netlify deploy --build --prod
```

No webhook endpoint is implemented yet. Do not configure Paystack or Meta production webhook URLs until signature verification, idempotency, and provider contract tests are delivered.

## 5. Mandatory live release smoke tests

Use real staging records created specifically for verification. Do not seed sample records in production.

- Register, receive email, verify, create an organization, and confirm initial owner membership and trial timestamps.
- Verify duplicate onboarding is rejected and an unconfirmed account cannot bootstrap an organization.
- Login, refresh, expire/refresh a session, logout, and verify protected pages become inaccessible.
- Request password reset, follow the emailed link, change password, and verify the old password no longer signs in.
- Create two independent organizations using two accounts. Query and mutate Organization B's UUIDs from A through the **Supabase REST API**, not only the UI. All cross-tenant attempts must fail or return no rows.
- Exercise member create/read/edit/archive; visitor create/edit/conversion twice; attendance batch insert/update; and the remaining record forms.
- Check actual Supabase Storage upload/read/delete denial across tenants even though the upload UI is unavailable.
- Verify failed database/provider calls never display success and leave retriable states.
- Verify permissions for each role, including suspension, confidential prayer data, and finance entitlements.
- Provision a staging paid entitlement only through an authorized test operator, then verify report CSV output and finance access. This is a staging fixture, not payment verification.
- Confirm production callbacks use the deployed HTTPS origin, no private pages are CDN-cached, server actions work, and secret values do not appear in browser bundles.
- Verify desktop/mobile/keyboard usability of authenticated pages. Current browser accessibility checks cover public setup/auth pages only.

`GET /api/health` is intentionally **not a readiness probe**: it reports configuration presence, not successful database connectivity. An unconfigured environment returns 503. A configured response still requires all the live checks above.
