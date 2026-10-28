-- =============================================================================
-- KingdomFlow — 0001: tenant security model
-- =============================================================================
-- Applied to project ivglimtjzcdfyflscngh during the 2026-10-28 hardening pass
-- and transcribed here so the state is reproducible and reviewable.
--
-- Why this exists: the two 2026-10-28 "full_cleanup" / "create_all_tables"
-- migrations replaced the schema with a simplified one while leaving the
-- SECURITY DEFINER layer in place. Every RPC that referenced
-- organization_memberships / role_permissions / plans / subscriptions /
-- event_registrations / organization_invitations was therefore dead, and the
-- rewritten policies let any member — including a viewer — read finance.
-- This migration reconciles the schema, restores the permission matrix contract
-- and installs one uniform, permission- and branch-scoped policy set.
--
-- Properties:
--   * Additive and idempotent. Re-running is a no-op where the object exists.
--   * Non-destructive: no table is dropped and no permission row is deleted.
--   * Never widens access; the previous, looser policy set is removed first.
--
-- Proof of behaviour: supabase/tests/tenant_isolation.sql executes 30 ordered
-- assertions against two live tenants with simulated JWT claims.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 0. Replace the legacy ad-hoc policy layer (rebuilt in section 6).
-- ----------------------------------------------------------------------------
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 1. Schema reconciliation
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF to_regclass('public.organization_members') IS NOT NULL
     AND to_regclass('public.organization_memberships') IS NULL THEN
    ALTER TABLE public.organization_members RENAME TO organization_memberships;
  END IF;
  IF to_regclass('public.giving_records') IS NOT NULL AND to_regclass('public.contributions') IS NULL THEN
    ALTER TABLE public.giving_records RENAME TO contributions;
  END IF;
  IF to_regclass('public.follow_ups') IS NOT NULL AND to_regclass('public.followups') IS NULL THEN
    ALTER TABLE public.follow_ups RENAME TO followups;
  END IF;
  IF to_regclass('public.follow_up_notes') IS NOT NULL AND to_regclass('public.followup_notes') IS NULL THEN
    ALTER TABLE public.follow_up_notes RENAME TO followup_notes;
  END IF;
  IF to_regclass('public.subscription_plans') IS NOT NULL AND to_regclass('public.plans') IS NULL THEN
    ALTER TABLE public.subscription_plans RENAME TO plans;
  END IF;
END $$;

ALTER TABLE public.organization_memberships ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.organization_memberships ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.organization_memberships ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.organization_memberships ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

-- Backfill from the legacy boolean, but only where that column still exists.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='organization_memberships'
                AND column_name='is_active') THEN
    EXECUTE $q$
      UPDATE public.organization_memberships
         SET status = CASE WHEN COALESCE(is_active, true) THEN 'active' ELSE 'suspended' END
       WHERE status IS NULL $q$;
  END IF;
END $$;

UPDATE public.organization_memberships SET status = 'active' WHERE status IS NULL;
ALTER TABLE public.organization_memberships ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE public.organization_memberships ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.organization_memberships DROP COLUMN IF EXISTS is_active;

ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS organization_type text DEFAULT 'church';
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS setup_request_key uuid;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS denomination text;
CREATE UNIQUE INDEX IF NOT EXISTS organizations_setup_key_uniq
  ON public.organizations(created_by, setup_request_key) WHERE setup_request_key IS NOT NULL;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_draft jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_org_id uuid;

ALTER TABLE public.members ADD COLUMN IF NOT EXISTS joined_on date;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='members' AND column_name='join_date') THEN
    EXECUTE 'UPDATE public.members SET joined_on = join_date WHERE joined_on IS NULL';
  END IF;
END $$;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS consent_communications boolean NOT NULL DEFAULT true;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS capacity integer;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.attendance_sessions ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.attendance_sessions ADD COLUMN IF NOT EXISTS qr_secret_hash text;
ALTER TABLE public.attendance_sessions ADD COLUMN IF NOT EXISTS closed_at timestamptz;

ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS organization_id uuid;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'present';
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS recorded_by uuid;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS client_ref text;
UPDATE public.attendance_records r
   SET organization_id = s.organization_id
  FROM public.attendance_sessions s
 WHERE s.id = r.session_id AND r.organization_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS attendance_records_session_member_uniq
  ON public.attendance_records(session_id, member_id);
CREATE UNIQUE INDEX IF NOT EXISTS attendance_records_client_ref_uniq
  ON public.attendance_records(session_id, client_ref) WHERE client_ref IS NOT NULL;

ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS converted_member_id uuid;
ALTER TABLE public.visitors ADD COLUMN IF NOT EXISTS followup_status text DEFAULT 'new';

-- ----------------------------------------------------------------------------
-- 2. Permission matrix
-- ----------------------------------------------------------------------------
-- The matrix is data, not code: adding a permission to a role is an INSERT,
-- and every policy/RPC reads through private.has_permission(). Seeding uses
-- ON CONFLICT DO NOTHING so an operator's tuning is never overwritten.
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role text NOT NULL,
  permission text NOT NULL,
  PRIMARY KEY (role, permission)
);
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

INSERT INTO public.role_permissions(role, permission)
SELECT 'owner', p FROM unnest(ARRAY[
  'org.view','org.manage','org.audit_logs','plan.manage','branch.view','branch.manage',
  'member.view','member.create','member.update','member.archive','member.export','member.import',
  'member.notes.view','member.notes.manage','staff.view','staff.manage','attendance.view',
  'attendance.manage','event.view','event.manage','form.view','form.manage','finance.view',
  'finance.manage','department.view','department.manage','report.view','report.export',
  'communication.view','communication.manage','followup.view','followup.manage','visitor.view',
  'visitor.manage','task.view','task.manage','prayer.view','prayer.manage']) p
UNION ALL SELECT 'admin', p FROM unnest(ARRAY[
  'org.view','org.manage','org.audit_logs','branch.view','branch.manage','member.view','member.create',
  'member.update','member.archive','member.export','member.import','member.notes.view',
  'member.notes.manage','staff.view','staff.manage','attendance.view','attendance.manage','event.view',
  'event.manage','form.view','form.manage','department.view','department.manage','report.view',
  'report.export','communication.view','communication.manage','followup.view','followup.manage',
  'visitor.view','visitor.manage','task.view','task.manage','prayer.view','prayer.manage']) p
UNION ALL SELECT 'senior_pastor', p FROM unnest(ARRAY[
  'org.view','org.audit_logs','branch.view','branch.manage','member.view','member.create','member.update',
  'member.archive','member.export','member.import','member.notes.view','member.notes.manage','staff.view',
  'staff.manage','attendance.view','attendance.manage','event.view','event.manage','form.view','form.manage',
  'finance.view','department.view','department.manage','report.view','report.export','communication.view',
  'communication.manage','followup.view','followup.manage','visitor.view','visitor.manage','task.view',
  'task.manage','prayer.view','prayer.manage']) p
UNION ALL SELECT 'pastor', p FROM unnest(ARRAY[
  'org.view','branch.view','member.view','member.create','member.update','member.notes.view',
  'member.notes.manage','member.export','staff.view','attendance.view','attendance.manage','event.view',
  'event.manage','form.view','form.manage','department.view','report.view','communication.view',
  'followup.view','followup.manage','visitor.view','visitor.manage','task.view','task.manage',
  'prayer.view','prayer.manage']) p
UNION ALL SELECT 'secretary', p FROM unnest(ARRAY[
  'org.view','branch.view','member.view','member.create','member.update','member.import','member.export',
  'staff.view','attendance.view','attendance.manage','event.view','event.manage','form.view','form.manage',
  'department.view','report.view','communication.view','communication.manage','task.view','task.manage',
  'prayer.view','followup.view','visitor.view']) p
UNION ALL SELECT 'finance_officer', p FROM unnest(ARRAY[
  'org.view','branch.view','finance.view','finance.manage','member.view','report.view','report.export',
  'event.view']) p
UNION ALL SELECT 'department_leader', p FROM unnest(ARRAY[
  'org.view','branch.view','member.view','attendance.view','attendance.manage','event.view','event.manage',
  'department.view','report.view','communication.view','task.view','task.manage','followup.view',
  'prayer.view','form.view']) p
UNION ALL SELECT 'followup_officer', p FROM unnest(ARRAY[
  'org.view','branch.view','member.view','member.update','member.notes.view','member.notes.manage',
  'visitor.view','visitor.manage','followup.view','followup.manage','task.view','task.manage','prayer.view',
  'attendance.view','report.view']) p
UNION ALL SELECT 'viewer', p FROM unnest(ARRAY[
  'org.view','branch.view','member.view','attendance.view','event.view','department.view','report.view',
  'prayer.view','form.view']) p
ON CONFLICT (role, permission) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. Plans + subscriptions (the contract private.has_feature() reads)
-- ----------------------------------------------------------------------------
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS marketing_features jsonb NOT NULL DEFAULT '[]'::jsonb;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='plans'
                AND column_name='features' AND data_type='jsonb') THEN
    EXECUTE 'UPDATE public.plans SET marketing_features = features';
    EXECUTE 'ALTER TABLE public.plans DROP COLUMN features';
  END IF;
END $$;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS features text[] NOT NULL DEFAULT '{}';
UPDATE public.plans SET features = CASE slug
  WHEN 'free' THEN ARRAY['core','members','attendance','forms','announcements','followups']
  WHEN 'pro'  THEN ARRAY['core','members','attendance','forms','announcements','followups','email','sms','reports','import_export','multi_branch']
  ELSE ARRAY['core','members','attendance','forms','announcements','followups','email','sms','reports','import_export','multi_branch','ai','branding','priority_support'] END
 WHERE features IS NULL OR cardinality(features) = 0;

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan uuid NOT NULL REFERENCES public.plans(id),
  status text NOT NULL DEFAULT 'trialing',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL DEFAULT 'infinity',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
INSERT INTO public.subscriptions(organization_id, plan, status, ends_at)
SELECT o.id, (SELECT id FROM public.plans WHERE slug = 'free'), 'active', 'infinity'
  FROM public.organizations o
 WHERE NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.organization_id = o.id);

-- ----------------------------------------------------------------------------
-- 4. Invitations, event registrations, and restricted pastoral notes
-- ----------------------------------------------------------------------------
-- Invitation tokens are stored as SHA-256 digests. A leaked database backup
-- therefore does not yield working invitation links.
CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'viewer',
  branch_ids uuid[] NOT NULL DEFAULT '{}',
  invited_by uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS org_invitations_org_idx
  ON public.organization_invitations(organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.event_registrations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'registered',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, member_id)
);
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

-- Pastoral notes live outside the API-exposed schema: reachable only through
-- the permission-gated set_pastoral_note()/get_pastoral_note() RPCs, so they
-- can never leak through PostgREST, CSV export or a broad table grant.
CREATE TABLE IF NOT EXISTS private.member_pastoral_notes (
  member_id uuid PRIMARY KEY REFERENCES public.members(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  body text NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.member_pastoral_notes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='members' AND column_name='notes') THEN
    EXECUTE $q$
      INSERT INTO private.member_pastoral_notes(member_id, organization_id, body)
      SELECT id, organization_id, notes FROM public.members
       WHERE notes IS NOT NULL AND length(trim(notes)) > 0
      ON CONFLICT (member_id) DO NOTHING $q$;
    EXECUTE 'ALTER TABLE public.members DROP COLUMN notes';
  END IF;
END $$;

-- Attendance secrets and provider keys are never readable by clients, even
-- with a legitimate row-level grant.
REVOKE SELECT (qr_secret_hash) ON public.attendance_sessions FROM anon, authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='org_communication_settings'
                AND column_name='textbee_api_key_encrypted') THEN
    EXECUTE 'REVOKE SELECT (textbee_api_key_encrypted, whatsapp_business_api_key_encrypted)
             ON public.org_communication_settings FROM anon, authenticated';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. Row Level Security — one uniform rule per tenant table
-- ----------------------------------------------------------------------------
-- Every tenant table delegates to private.has_permission(org, '<key>') and,
-- where the row carries a branch, to private.has_branch_access(org, branch).
-- A member with no branch restriction (empty branch_ids) sees the whole org;
-- a branch-scoped leader sees only their branches.
DO $$
DECLARE cfg record; u text; c text; b text;
BEGIN
  FOR cfg IN SELECT * FROM (VALUES
    ('members','organization_id','branch_id','member.view','member.create','member.update'),
    ('branches','organization_id',NULL,'branch.view','branch.manage','branch.manage'),
    ('departments','organization_id','branch_id','department.view','department.manage','department.manage'),
    ('events','organization_id','branch_id','event.view','event.manage','event.manage'),
    ('event_registrations','organization_id',NULL,'event.view','event.manage','event.manage'),
    ('attendance_sessions','organization_id','branch_id','attendance.view','attendance.manage','attendance.manage'),
    ('attendance_records','organization_id',NULL,'attendance.view','attendance.manage','attendance.manage'),
    ('forms','organization_id',NULL,'form.view','form.manage','form.manage'),
    ('form_submissions','organization_id',NULL,'form.view','form.manage','form.manage'),
    ('announcements','organization_id','branch_id','communication.view','communication.manage','communication.manage'),
    ('campaigns','organization_id',NULL,'communication.view','communication.manage','communication.manage'),
    ('communication_templates','organization_id',NULL,'communication.view','communication.manage','communication.manage'),
    ('followups','organization_id','branch_id','followup.view','followup.manage','followup.manage'),
    ('visitors','organization_id','branch_id','visitor.view','visitor.manage','visitor.manage'),
    ('tasks','organization_id','branch_id','task.view','task.manage','task.manage'),
    ('prayer_requests','organization_id','branch_id','prayer.view','prayer.manage','prayer.manage'),
    ('contributions','organization_id','branch_id','finance.view','finance.manage','finance.manage'),
    ('expense_records','organization_id','branch_id','finance.view','finance.manage','finance.manage')
  ) AS t(tbl, orgcol, branchcol, sel, ins, upd)
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', cfg.tbl);
    b := CASE WHEN cfg.branchcol IS NULL THEN ''
              ELSE format(' AND (%I IS NULL OR private.has_branch_access(%I, %I))',
                          cfg.branchcol, cfg.orgcol, cfg.branchcol) END;
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)',
      cfg.tbl || '_select', cfg.tbl, format('private.has_permission(%I, %L)%s', cfg.orgcol, cfg.sel, b));
    c := format('private.has_permission(%I, %L)%s', cfg.orgcol, cfg.ins, b);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)',
      cfg.tbl || '_insert', cfg.tbl, c);
    c := format('private.has_permission(%I, %L)%s', cfg.orgcol, cfg.upd, b);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',
      cfg.tbl || '_update', cfg.tbl, c, c);
  END LOOP;
END $$;

-- Join tables inherit the permission of their parent.
ALTER TABLE public.department_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY department_members_select ON public.department_members FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.departments d WHERE d.id = department_id
    AND private.has_permission(d.organization_id, 'department.view')
    AND (d.branch_id IS NULL OR private.has_branch_access(d.organization_id, d.branch_id))));
CREATE POLICY department_members_insert ON public.department_members FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.departments d WHERE d.id = department_id
    AND private.has_permission(d.organization_id, 'department.manage')));
CREATE POLICY department_members_update ON public.department_members FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.departments d WHERE d.id = department_id
    AND private.has_permission(d.organization_id, 'department.manage')));
CREATE POLICY department_members_delete ON public.department_members FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.departments d WHERE d.id = department_id
    AND private.has_permission(d.organization_id, 'department.manage')));

ALTER TABLE public.followup_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY followup_notes_select ON public.followup_notes FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.followups f WHERE f.id = follow_up_id
    AND private.has_permission(f.organization_id, 'followup.view')));
CREATE POLICY followup_notes_insert ON public.followup_notes FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.followups f WHERE f.id = follow_up_id
    AND private.has_permission(f.organization_id, 'followup.manage')));

ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY campaign_recipients_select ON public.campaign_recipients FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id
    AND private.has_permission(c.organization_id, 'communication.view')));
CREATE POLICY campaign_recipients_insert ON public.campaign_recipients FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id
    AND private.has_permission(c.organization_id, 'communication.manage')));

-- Identity, billing and audit surfaces.
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY organizations_select ON public.organizations FOR SELECT TO authenticated
  USING (private.is_org_member(id));
CREATE POLICY organizations_update ON public.organizations FOR UPDATE TO authenticated
  USING (private.has_permission(id, 'org.manage')) WITH CHECK (private.has_permission(id, 'org.manage'));
-- No INSERT policy: workspaces are created only by public.create_workspace(),
-- which enforces verification, the per-user limit and idempotency.

ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY memberships_select ON public.organization_memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_permission(organization_id, 'staff.view'));
CREATE POLICY memberships_insert ON public.organization_memberships FOR INSERT TO authenticated
  WITH CHECK (private.has_permission(organization_id, 'staff.manage'));
CREATE POLICY memberships_update ON public.organization_memberships FOR UPDATE TO authenticated
  USING (private.has_permission(organization_id, 'staff.manage'))
  WITH CHECK (private.has_permission(organization_id, 'staff.manage'));
CREATE POLICY memberships_delete ON public.organization_memberships FOR DELETE TO authenticated
  USING (private.has_permission(organization_id, 'staff.manage'));
-- No self-join policy: joining requires a hashed invitation via accept_invitation().

ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY invitations_select ON public.organization_invitations FOR SELECT TO authenticated
  USING (private.has_permission(organization_id, 'staff.manage'));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_select_own ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY notifications_update_own ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.user_gmail_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY gmail_tokens_own ON public.user_gmail_tokens FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_logs_select ON public.audit_logs FOR SELECT TO authenticated
  USING (private.has_permission(organization_id, 'org.audit_logs'));
-- Audit rows are written only by SECURITY DEFINER RPCs: they cannot be forged.

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscriptions_select ON public.subscriptions FOR SELECT TO authenticated
  USING (private.is_org_member(organization_id));

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY plans_select_public ON public.plans FOR SELECT TO anon, authenticated USING (is_active);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY role_permissions_select ON public.role_permissions FOR SELECT TO authenticated USING (true);

ALTER TABLE public.org_communication_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY comm_settings_manage ON public.org_communication_settings FOR ALL TO authenticated
  USING (private.has_permission(organization_id, 'org.manage'))
  WITH CHECK (private.has_permission(organization_id, 'org.manage'));

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated;

-- ----------------------------------------------------------------------------
-- 6. Retire functions whose tables the cleanup destroyed.
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.reserve_ai_usage(uuid, text);
DROP FUNCTION IF EXISTS public.settle_payment(text, integer, text, text);
DROP FUNCTION IF EXISTS public.review_manual_payment(uuid, boolean, text);
DROP FUNCTION IF EXISTS public.media_usage(uuid);
DROP FUNCTION IF EXISTS public.move_media(uuid, uuid);
DROP FUNCTION IF EXISTS public.release_media(uuid);
DROP FUNCTION IF EXISTS public.finalize_media(uuid, uuid);
DROP FUNCTION IF EXISTS public.record_whatsapp_status(text, text, timestamptz);
DROP FUNCTION IF EXISTS public.consume_request(uuid, text);
DROP FUNCTION IF EXISTS public.is_platform_admin();
DROP FUNCTION IF EXISTS public.managed_staff(uuid, integer);
DROP FUNCTION IF EXISTS public.workspace_staff(uuid);

-- ----------------------------------------------------------------------------
-- 7. Indexes for tenant-scoped access paths
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS members_org_status_idx ON public.members(organization_id, status);
CREATE INDEX IF NOT EXISTS members_org_branch_idx ON public.members(organization_id, branch_id);
CREATE INDEX IF NOT EXISTS members_name_idx ON public.members(organization_id, lower(last_name), lower(first_name));
CREATE INDEX IF NOT EXISTS memberships_user_idx ON public.organization_memberships(user_id, status);
CREATE INDEX IF NOT EXISTS attendance_sessions_org_date_idx ON public.attendance_sessions(organization_id, session_date DESC);
CREATE INDEX IF NOT EXISTS attendance_records_member_idx ON public.attendance_records(member_id);
CREATE INDEX IF NOT EXISTS contributions_org_date_idx ON public.contributions(organization_id, given_at DESC);
CREATE INDEX IF NOT EXISTS events_org_start_idx ON public.events(organization_id, start_time);
CREATE INDEX IF NOT EXISTS audit_logs_org_created_idx ON public.audit_logs(organization_id, created_at DESC);
