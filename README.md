# KingdomFlow

**Members. Ministry. Growth. One Platform.**

A multi-tenant church and ministry workspace built with Next.js App Router, React, strict TypeScript, Tailwind, shadcn-style primitives, and Supabase.

## Current release: foundation & core operations

The starting repository contained only a README. This implementation stays in the same repository and establishes the application, security boundaries, migrations, and core operational workflows. It is **not yet a fully provisioned production SaaS**. Supabase and Netlify are not connected in the build environment; no provider success is simulated.

### Run locally

```bash
npm ci
cp .env.example .env.local
# Configure your own Supabase project and canonical app URL in .env.local.
# Apply all migrations before attempting registration/onboarding.
npm run dev
```

Without configuration, the application displays **Configuration Required** and disables authentication submissions. It does not load sample records. The development server binds to `0.0.0.0:3000`; preview hosts under `*.e2b.app` are supported.

### Quality gates

```bash
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

Browser tests target an **unconfigured deployment** and verify honest failure states, protected routing, mobile layout, security headers, and automated accessibility checks. They do not impersonate a live Supabase service. Run with provider variables unset. Database tests execute the migrations and RLS in PGlite (real embedded PostgreSQL), with minimal Auth/Storage schema fixtures; they do not prove hosted Supabase email, PostgREST, or storage API integration.

## Architecture

- `src/app`: SSR pages, server actions, auth callback, report export, health endpoint.
- `src/lib/auth.ts`: verified identity, active workspace selection, database permission checks.
- `src/lib/modules.ts`: allowlisted fields and shared client/server Zod validation.
- `src/lib/supabase`: SSR and browser anon-key clients; no service-role use in core operations.
- `supabase/migrations`: tenant tables, composite foreign keys, RLS, audit triggers, explicit grants, private storage, and plan catalog.
- `tests`: input/redirect safety, auth boundary tests, executable SQL/RLS tests, browser checks.
- `netlify.toml`: Next.js deployment build configuration.

## Documentation

- [Initial repository audit](docs/AUDIT.md)
- [Engineering report and feature status](docs/ENGINEERING_REPORT.md)
- [Supabase and Netlify deployment runbook](docs/DEPLOYMENT.md)
- [Security model and release gates](docs/SECURITY.md)

**Unavailable:** Paystack checkout/webhooks, manual MoMo approval, WhatsApp/email campaigns, and KingdomFlow AI. Their pages say so. Adding a provider credential alone does not implement these integrations.
