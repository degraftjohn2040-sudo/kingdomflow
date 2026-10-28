# Deployment

Target: Vercel (application) + Supabase (database, auth) + this GitHub repository.

A Vercel project named `kingdomflow` already exists and already holds the correct environment
variables for all three environments. It has **no deployments** and its Git integration is
disabled, so connecting the repository is the first step.

## 1. Connect the repository

Vercel dashboard → project `kingdomflow` → **Settings → Git** → connect
`degraftjohn2040-sudo/kingdomflow`, production branch `main`, framework preset **Next.js**.
No build or output overrides are needed (`npm run build`, `.next`).

## 2. Environment variables

Already present on the project:

| Key | Environments | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | production, preview, development | same project for all |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | production, preview, development | safe to expose |
| `SUPABASE_SERVICE_ROLE_KEY` | production, preview, development | server-only; never referenced in client components |

Add:

| Key | Example | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | `https://kingdomflow.vercel.app` | used to build auth and invitation redirects |

Separate local / preview / production configuration is achieved by using distinct keys or a
separate Supabase project per environment; the code reads only these four variables.

## 3. Supabase Auth URLs

Auth currently points at the old Zite host (`site_url = https://kingdomflow.zite.so`). Update
**Authentication → URL Configuration**:

- Site URL: `https://<your-production-domain>`
- Redirect URLs:
  - `https://<your-production-domain>/auth/callback`
  - `https://<your-production-domain>/auth/confirm`
  - `https://<your-production-domain>/reset-password`
  - `https://*-<team>.vercel.app/auth/callback` (preview deployments)
  - `http://localhost:3000/auth/callback` and `/auth/confirm` (local)

Leaving these as `zite.so` means every email confirmation and password reset lands on the wrong
application.

## 4. Database

The migrations in `supabase/migrations/` have already been applied to
`ivglimtjzcdfyflscngh`. For a new environment, apply them in order with:

```bash
supabase link --project-ref <ref>
supabase db push
```

Then run the two self-cleaning harnesses in `supabase/tests/` and confirm every assertion reports
`PASS`.

Seed a platform administrator deliberately (there is no UI for this, by design):

```sql
insert into private.platform_admins (user_id)
select id from auth.users where email = '<admin-email>'
on conflict do nothing;
```

## 5. Post-deploy checklist

- [ ] `/` renders the landing page and the plan cards come from `public.plans`
- [ ] Sign up → confirmation email → `/auth/confirm` → onboarding
- [ ] Onboarding creates exactly one organization, one main branch and the chosen departments
- [ ] Invite a second person; the link opens `/invite/<token>` and, once accepted, the role is correct
- [ ] A viewer cannot see Giving in the navigation, and `/giving` returns a permission error
- [ ] Take attendance, then do it again with the network disabled and confirm the queue syncs
- [ ] Mint a QR code, open `/checkin?…` on a phone and check in a linked member
- [ ] Archive a member and confirm their attendance and giving history remain

## 6. Not configured yet

- Transactional email provider (invitations and notifications are stored, not sent)
- SMS / WhatsApp providers
- Per-tenant Google Calendar OAuth
- Storage buckets (no member photo upload)

Each is an integration boundary in the codebase, not a broken button: the screens state what is
available rather than pretending to send.
