-- =============================================================================
-- KingdomFlow — restore and harden the tenant security model
-- =============================================================================
-- Context: the 2026-10-28 "full_cleanup" + "create_all_tables" migrations
-- replaced the original schema with a simplified one while leaving the
-- SECURITY DEFINER RPC layer in place. Every RPC that referenced
-- organization_memberships / role_permissions / plans / subscriptions /
-- event_registrations / organization_invitations was therefore broken, and the
-- rewritten RLS policies granted any member (including viewers) read access to
-- finance and pastoral data.
--
-- This migration reconciles the schema back to the contract the security layer
-- expects, introduces a permission matrix, replaces every ad-hoc policy with a
-- permission- and branch-scoped policy, closes privilege-escalation paths and
-- rebuilds the RPC surface used by the application.
--
-- Safe to re-run. No tenant data is destroyed: at the time of writing the
-- database held 0 organizations, 0 members and 5 auth users.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 0. Retire the legacy ad-hoc policy layer (rebuilt below).
-- ----------------------------------------------------------------------------
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
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
UPDATE public.organization_memberships
   SET status = CASE WHEN COALESCE(is_active, true) THEN 'active' ELSE 'suspended' END
 WHERE status IS NULL;
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
UPDATE public.members SET joined_on = join_date WHERE joined_on IS NULL;
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
UPDATE public.visitors SET converted_member_id = member_id
 WHERE converted_member_id IS NULL AND member_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. Permission matrix
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role text NOT NULL,
  permission text NOT NULL,
  PRIMARY KEY (role, permission)
);
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DELETE FROM public.role_permissions;
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
  'prayer.view','form.view']) p;

-- ----------------------------------------------------------------------------
-- 3. Plans + subscriptions (private.has_feature contract)
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
  ELSE ARRAY['core','members','attendance','forms','announcements','followups','email','sms','reports','import_export','multi_branch','ai','branding','priority_support'] END;

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
SELECT o.id, (SELECT id FROM public.plans WHERE slug='free'), 'active', 'infinity'
  FROM public.organizations o
ON CONFLICT (organization_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. New tables: invitations, registrations, pastoral notes
-- ----------------------------------------------------------------------------
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
-- permission-gated RPCs, never through PostgREST or exports.
CREATE TABLE IF NOT EXISTS private.member_pastoral_notes (
  member_id uuid PRIMARY KEY REFERENCES public.members(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  body text NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.member_pastoral_notes ENABLE ROW LEVEL SECURITY;
INSERT INTO private.member_pastoral_notes(member_id, organization_id, body)
SELECT id, organization_id, notes FROM public.members
 WHERE notes IS NOT NULL AND length(trim(notes)) > 0
ON CONFLICT (member_id) DO NOTHING;
ALTER TABLE public.members DROP COLUMN IF EXISTS notes;

-- ----------------------------------------------------------------------------
-- 5. Helpers, guards and triggers
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.has_branch_access(target_org uuid, target_branch uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT target_branch IS NULL OR EXISTS (
    SELECT 1 FROM public.organization_memberships m
    WHERE m.organization_id = target_org AND m.user_id = auth.uid() AND m.status = 'active'
      AND (m.branch_ids IS NULL OR cardinality(m.branch_ids) = 0 OR target_branch = ANY(m.branch_ids)));
$$;

CREATE OR REPLACE FUNCTION public.auto_assign_free_plan() RETURNS trigger
LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  IF NEW.plan_id IS NULL THEN NEW.plan_id := (SELECT id FROM public.plans WHERE slug='free'); END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.update_org_contact_count() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE oid uuid;
BEGIN
  oid := COALESCE(NEW.organization_id, OLD.organization_id);
  IF oid IS NOT NULL THEN
    UPDATE public.organizations
       SET contact_count = (SELECT count(*) FROM public.members WHERE organization_id = oid AND status <> 'archived')
     WHERE id = oid;
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION private.assign_default_plan() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE p uuid;
BEGIN
  SELECT id INTO p FROM public.plans WHERE slug='free' LIMIT 1;
  IF p IS NOT NULL THEN
    INSERT INTO public.subscriptions(organization_id, plan, status, ends_at)
    VALUES (NEW.id, p, 'active', 'infinity') ON CONFLICT (organization_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_assign_default_plan ON public.organizations;
CREATE TRIGGER trg_assign_default_plan AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION private.assign_default_plan();

CREATE OR REPLACE FUNCTION private.guard_membership_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE actor_role text;
BEGIN
  SELECT role INTO actor_role FROM public.organization_memberships
   WHERE organization_id = NEW.organization_id AND user_id = auth.uid() AND status = 'active';
  IF NEW.user_id = auth.uid() AND actor_role <> 'owner'
     AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status) THEN
    RAISE EXCEPTION 'You cannot change your own role or access' USING ERRCODE='42501';
  END IF;
  IF NEW.role = 'owner' AND OLD.role <> 'owner' AND actor_role <> 'owner' THEN
    RAISE EXCEPTION 'Only an owner can grant ownership' USING ERRCODE='42501';
  END IF;
  IF OLD.role = 'owner' AND NEW.role <> 'owner'
     AND (SELECT count(*) FROM public.organization_memberships
           WHERE organization_id = OLD.organization_id AND role='owner' AND status='active') <= 1 THEN
    RAISE EXCEPTION 'An organization must keep at least one owner' USING ERRCODE='42501';
  END IF;
  IF NEW.role NOT IN (SELECT DISTINCT role FROM public.role_permissions) THEN
    RAISE EXCEPTION 'Unknown role';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_membership ON public.organization_memberships;
CREATE TRIGGER trg_guard_membership BEFORE UPDATE ON public.organization_memberships
  FOR EACH ROW EXECUTE FUNCTION private.guard_membership_change();

CREATE OR REPLACE FUNCTION private.guard_profile_flags() RETURNS trigger
LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  IF NEW.is_platform_admin IS DISTINCT FROM OLD.is_platform_admin
     AND current_user NOT IN ('postgres','supabase_admin','service_role') THEN
    RAISE EXCEPTION 'Platform privileges cannot be self-assigned' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_profile_flags ON public.profiles;
CREATE TRIGGER trg_guard_profile_flags BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.guard_profile_flags();

REVOKE SELECT (qr_secret_hash) ON public.attendance_sessions FROM anon, authenticated;
REVOKE SELECT (textbee_api_key_encrypted, whatsapp_business_api_key_encrypted)
  ON public.org_communication_settings FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. Row Level Security — permission matrix + branch scope
-- ----------------------------------------------------------------------------
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
    u := format('private.has_permission(%I, %L)%s', cfg.orgcol, cfg.sel, b);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)',
                   cfg.tbl || '_select', cfg.tbl, u);
    c := format('private.has_permission(%I, %L)%s', cfg.orgcol, cfg.ins, b);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)',
                   cfg.tbl || '_insert', cfg.tbl, c);
    c := format('private.has_permission(%I, %L)%s', cfg.orgcol, cfg.upd, b);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',
                   cfg.tbl || '_update', cfg.tbl, c, c);
  END LOOP;
END $$;

-- Join-based tables
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

-- Organization-scoped identity tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY organizations_select ON public.organizations FOR SELECT TO authenticated
  USING (private.is_org_member(id));
CREATE POLICY organizations_update ON public.organizations FOR UPDATE TO authenticated
  USING (private.has_permission(id, 'org.manage')) WITH CHECK (private.has_permission(id, 'org.manage'));
-- No INSERT policy: organizations are created only through public.create_workspace().

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
-- Audit rows are written by SECURITY DEFINER RPCs only.

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
-- 7. RPC surface
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_workspace(uuid, jsonb);
CREATE FUNCTION public.create_workspace(request_key uuid, setup jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE org_id uuid; org_slug text; dept text; p uuid; actor_email text; actor_name text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF NOT private.verified_account() THEN
    RAISE EXCEPTION 'Verify your email address before creating a workspace' USING ERRCODE='42501';
  END IF;
  IF request_key IS NULL THEN RAISE EXCEPTION 'A request key is required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 2));
  SELECT id INTO org_id FROM public.organizations
   WHERE created_by = auth.uid() AND setup_request_key = request_key;
  IF org_id IS NOT NULL THEN RETURN org_id; END IF;
  IF jsonb_typeof(setup) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid setup payload'; END IF;
  IF length(trim(coalesce(setup->>'name', ''))) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Enter your church or ministry name';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = setup->>'timezone') THEN
    RAISE EXCEPTION 'Choose a valid timezone';
  END IF;
  IF jsonb_typeof(setup->'departments') IS DISTINCT FROM 'array'
     OR jsonb_array_length(setup->'departments') > 20 THEN
    RAISE EXCEPTION 'Add at most 20 departments';
  END IF;
  IF (SELECT count(*) FROM public.organizations WHERE created_by = auth.uid()) >= 5 THEN
    RAISE EXCEPTION 'Workspace limit reached';
  END IF;

  SELECT email INTO actor_email FROM auth.users WHERE id = auth.uid();
  UPDATE public.profiles
     SET full_name = COALESCE(NULLIF(trim(setup->>'full_name'), ''), full_name),
         phone = NULLIF(trim(setup->>'profile_phone'), ''),
         onboarding_draft = '{}'::jsonb
   WHERE id = auth.uid()
  RETURNING full_name INTO actor_name;

  org_slug := trim(both '-' from left(regexp_replace(lower(setup->>'name'), '[^a-z0-9]+', '-', 'g'), 60));
  org_slug := COALESCE(NULLIF(org_slug, ''), 'church') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  INSERT INTO public.organizations(name, slug, organization_type, country, timezone, currency, city, phone,
      email, denomination, created_by, onboarding_complete, setup_request_key, plan)
  VALUES (trim(setup->>'name'), org_slug, COALESCE(NULLIF(setup->>'organization_type', ''), 'church'),
      COALESCE(NULLIF(setup->>'country', ''), 'GH'), setup->>'timezone',
      COALESCE(NULLIF(setup->>'currency', ''), 'GHS'), NULLIF(trim(setup->>'city'), ''),
      NULLIF(trim(setup->>'phone'), ''), NULLIF(trim(setup->>'email'), ''),
      NULLIF(trim(setup->>'denomination'), ''), auth.uid(), true, request_key, 'free')
  RETURNING id INTO org_id;

  INSERT INTO public.organization_memberships(organization_id, user_id, role, status, full_name, email, joined_at)
  VALUES (org_id, auth.uid(), 'owner', 'active', actor_name, actor_email, now());

  SELECT id INTO p FROM public.plans WHERE slug='free' LIMIT 1;
  IF p IS NOT NULL THEN
    INSERT INTO public.subscriptions(organization_id, plan, status, ends_at)
    VALUES (org_id, p, 'active', 'infinity') ON CONFLICT (organization_id) DO NOTHING;
  END IF;

  INSERT INTO public.branches(organization_id, name, slug, is_main, status, city)
  VALUES (org_id, COALESCE(NULLIF(trim(setup->>'branch_name'), ''), 'Main Campus'), 'main-campus', true,
      'active', NULLIF(trim(setup->>'city'), ''));

  FOR dept IN SELECT trim(value) FROM jsonb_array_elements_text(setup->'departments') LOOP
    IF length(dept) BETWEEN 2 AND 80 THEN
      INSERT INTO public.departments(organization_id, name, slug)
      VALUES (org_id, dept, trim(both '-' from regexp_replace(lower(dept), '[^a-z0-9]+', '-', 'g')));
    END IF;
  END LOOP;

  INSERT INTO public.audit_logs(organization_id, user_id, action, resource_type, resource_id)
  VALUES (org_id, auth.uid(), 'workspace.created', 'organization', org_id);
  RETURN org_id;
END $$;

DROP FUNCTION IF EXISTS public.accept_invitation(text);
CREATE FUNCTION public.accept_invitation(invitation_token text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE invite public.organization_invitations; verified_email text; existing text;
BEGIN
  IF NOT private.verified_account() THEN RAISE EXCEPTION 'Verify your account first' USING ERRCODE='42501'; END IF;
  IF invitation_token IS NULL OR invitation_token !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invitation unavailable' USING ERRCODE='42501';
  END IF;
  SELECT lower(email) INTO verified_email FROM auth.users
   WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL;
  SELECT * INTO invite FROM public.organization_invitations
   WHERE token_hash = encode(extensions.digest(invitation_token, 'sha256'), 'hex');
  IF invite.id IS NULL THEN RAISE EXCEPTION 'Invitation unavailable' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(invite.organization_id::text, 7));
  SELECT * INTO invite FROM public.organization_invitations WHERE id = invite.id FOR UPDATE;
  IF invite.expires_at <= now() OR invite.accepted_at IS NOT NULL OR invite.revoked_at IS NOT NULL
     OR lower(invite.email) IS DISTINCT FROM verified_email THEN
    RAISE EXCEPTION 'This invitation is no longer valid' USING ERRCODE='42501';
  END IF;
  SELECT status INTO existing FROM public.organization_memberships
   WHERE organization_id = invite.organization_id AND user_id = auth.uid();
  IF existing IS NOT NULL THEN RAISE EXCEPTION 'You already belong to this workspace'; END IF;
  INSERT INTO public.organization_memberships(organization_id, user_id, role, status, branch_ids,
      invited_by, invited_at, joined_at, email)
  VALUES (invite.organization_id, auth.uid(), invite.role, 'active', invite.branch_ids, invite.invited_by,
      invite.created_at, now(), verified_email);
  UPDATE public.organization_invitations SET accepted_at = now() WHERE id = invite.id;
  INSERT INTO public.audit_logs(organization_id, user_id, action, resource_type, details)
  VALUES (invite.organization_id, auth.uid(), 'staff.joined', 'organization_membership',
      jsonb_build_object('role', invite.role));
  RETURN invite.organization_id;
END $$;

DROP FUNCTION IF EXISTS public.my_permissions(uuid);
CREATE FUNCTION public.my_permissions(target_org uuid) RETURNS SETOF text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT m.role || ':' || rp.permission
    FROM public.organization_memberships m
    JOIN public.role_permissions rp ON rp.role = m.role
   WHERE m.organization_id = target_org AND m.user_id = auth.uid() AND m.status = 'active';
$$;

DROP FUNCTION IF EXISTS public.invite_staff(uuid, text, text, uuid[]);
CREATE FUNCTION public.invite_staff(target_org uuid, p_email text, p_role text,
    p_branch_ids uuid[] DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE raw text; rec public.organization_invitations; actor_role text; perms text[]; target_perms text[];
BEGIN
  IF NOT private.has_permission(target_org, 'staff.manage') THEN
    RAISE EXCEPTION 'Permission required' USING ERRCODE='42501';
  END IF;
  IF p_email IS NULL OR lower(trim(p_email)) !~ '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' THEN
    RAISE EXCEPTION 'Enter a valid email address';
  END IF;
  SELECT role INTO actor_role FROM public.organization_memberships
   WHERE organization_id = target_org AND user_id = auth.uid() AND status = 'active';
  IF NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role = p_role) OR p_role = 'owner' THEN
    RAISE EXCEPTION 'Choose a valid role';
  END IF;
  IF actor_role <> 'owner' AND p_role IN ('admin', 'senior_pastor') THEN
    RAISE EXCEPTION 'Only an owner can invite that role' USING ERRCODE='42501';
  END IF;
  IF actor_role <> 'owner' THEN
    SELECT array_agg(permission) INTO perms FROM public.role_permissions WHERE role = actor_role;
    SELECT array_agg(permission) INTO target_perms FROM public.role_permissions WHERE role = p_role;
    IF NOT (target_perms <@ perms) THEN
      RAISE EXCEPTION 'You cannot grant permissions you do not hold' USING ERRCODE='42501';
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.organization_invitations
              WHERE organization_id = target_org AND lower(email) = lower(trim(p_email))
                AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()) THEN
    RAISE EXCEPTION 'An active invitation already exists for that email';
  END IF;
  IF EXISTS (SELECT 1 FROM public.organization_memberships m JOIN auth.users u ON u.id = m.user_id
              WHERE m.organization_id = target_org AND lower(u.email) = lower(trim(p_email))) THEN
    RAISE EXCEPTION 'That person is already on your team';
  END IF;
  raw := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO public.organization_invitations(organization_id, email, role, branch_ids, invited_by,
      token_hash, expires_at)
  VALUES (target_org, lower(trim(p_email)), p_role, COALESCE(p_branch_ids, '{}'), auth.uid(),
      encode(extensions.digest(raw, 'sha256'), 'hex'), now() + interval '7 days')
  RETURNING * INTO rec;
  INSERT INTO public.audit_logs(organization_id, user_id, action, resource_type, resource_id, details)
  VALUES (target_org, auth.uid(), 'staff.invited', 'organization_invitation', rec.id,
      jsonb_build_object('email', rec.email, 'role', rec.role));
  RETURN jsonb_build_object('id', rec.id, 'token', raw, 'expires_at', rec.expires_at,
      'email', rec.email, 'role', rec.role);
END $$;

DROP FUNCTION IF EXISTS public.revoke_invitation(uuid, uuid);
CREATE FUNCTION public.revoke_invitation(target_org uuid, invitation_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT private.has_permission(target_org, 'staff.manage') THEN
    RAISE EXCEPTION 'Permission required' USING ERRCODE='42501';
  END IF;
  UPDATE public.organization_invitations SET revoked_at = now()
   WHERE id = invitation_id AND organization_id = target_org
     AND accepted_at IS NULL AND revoked_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  INSERT INTO public.audit_logs(organization_id, user_id, action, resource_type, resource_id)
  VALUES (target_org, auth.uid(), 'staff.invitation_revoked', 'organization_invitation', invitation_id);
END $$;

DROP FUNCTION IF EXISTS public.change_membership(uuid, uuid, text, text);
CREATE FUNCTION public.change_membership(target_org uuid, target_user uuid, new_role text, new_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT private.has_permission(target_org, 'staff.manage') THEN
    RAISE EXCEPTION 'Permission required' USING ERRCODE='42501';
  END IF;
  IF new_status NOT IN ('active', 'suspended') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  UPDATE public.organization_memberships
     SET role = COALESCE(new_role, role), status = new_status
   WHERE organization_id = target_org AND user_id = target_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'Team member not found'; END IF;
  INSERT INTO public.audit_logs(organization_id, user_id, action, resource_type, details)
  VALUES (target_org, auth.uid(), 'staff.role_changed', 'organization_membership',
      jsonb_build_object('target_user', target_user, 'role', new_role, 'status', new_status));
END $$;

DROP FUNCTION IF EXISTS public.workspace_summary(uuid, date, date);
CREATE FUNCTION public.workspace_summary(target_org uuid,
    p_from date DEFAULT (CURRENT_DATE - INTERVAL '30 days')::date,
    p_to date DEFAULT CURRENT_DATE) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE can_finance boolean; result jsonb;
BEGIN
  IF NOT private.has_permission(target_org, 'org.view') THEN
    RAISE EXCEPTION 'Permission required' USING ERRCODE='42501';
  END IF;
  can_finance := private.has_permission(target_org, 'finance.view');
  SELECT jsonb_build_object(
    'members_total', (SELECT count(*) FROM public.members WHERE organization_id = target_org AND status <> 'archived'),
    'members_active', (SELECT count(*) FROM public.members WHERE organization_id = target_org AND status = 'active' AND archived_at IS NULL),
    'members_new', (SELECT count(*) FROM public.members WHERE organization_id = target_org AND created_at::date BETWEEN p_from AND p_to),
    'visitors', (SELECT count(*) FROM public.visitors WHERE organization_id = target_org AND visit_date BETWEEN p_from AND p_to),
    'sessions', (SELECT count(*) FROM public.attendance_sessions WHERE organization_id = target_org AND session_date BETWEEN p_from AND p_to),
    'attendance_present', (SELECT count(*) FROM public.attendance_records ar JOIN public.attendance_sessions s ON s.id = ar.session_id
        WHERE s.organization_id = target_org AND s.session_date BETWEEN p_from AND p_to AND ar.status = 'present'),
    'open_followups', (SELECT count(*) FROM public.followups WHERE organization_id = target_org AND status = 'open'),
    'open_tasks', (SELECT count(*) FROM public.tasks WHERE organization_id = target_org AND status <> 'done'),
    'upcoming_events', (SELECT count(*) FROM public.events WHERE organization_id = target_org AND start_time >= now() AND status = 'scheduled' AND archived_at IS NULL),
    'branches', (SELECT count(*) FROM public.branches WHERE organization_id = target_org AND status = 'active'),
    'departments', (SELECT count(*) FROM public.departments WHERE organization_id = target_org AND status = 'active'),
    'team', (SELECT count(*) FROM public.organization_memberships WHERE organization_id = target_org AND status = 'active'),
    'contributions_total', CASE WHEN can_finance THEN (SELECT COALESCE(sum(amount), 0) FROM public.contributions WHERE organization_id = target_org AND given_at BETWEEN p_from AND p_to) END,
    'expenses_total', CASE WHEN can_finance THEN (SELECT COALESCE(sum(amount), 0) FROM public.expense_records WHERE organization_id = target_org AND incurred_at BETWEEN p_from AND p_to) END,
    'can_finance', can_finance,
    'attendance_trend', COALESCE((SELECT jsonb_agg(row_to_json(t)) FROM (
        SELECT s.session_date AS day, count(ar.id) FILTER (WHERE ar.status = 'present') AS present
          FROM public.attendance_sessions s
          LEFT JOIN public.attendance_records ar ON ar.session_id = s.id
         WHERE s.organization_id = target_org AND s.session_date BETWEEN p_from AND p_to
         GROUP BY s.session_date ORDER BY s.session_date) t), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END $$;

DROP FUNCTION IF EXISTS public.record_attendance(uuid, uuid, jsonb);
CREATE FUNCTION public.record_attendance(target_org uuid, p_session uuid, records jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE item jsonb; n integer := 0;
BEGIN
  IF NOT private.has_permission(target_org, 'attendance.manage') THEN
    RAISE EXCEPTION 'Permission required' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(records) <> 'array' OR jsonb_array_length(records) > 250 THEN
    RAISE EXCEPTION 'Choose at most 250 people';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.attendance_sessions
                  WHERE id = p_session AND organization_id = target_org AND archived_at IS NULL) THEN
    RAISE EXCEPTION 'Session unavailable';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(records) LOOP
    IF (item->>'status') NOT IN ('present', 'absent', 'excused') THEN
      RAISE EXCEPTION 'Invalid attendance status';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.members
                    WHERE id = (item->>'member_id')::uuid AND organization_id = target_org) THEN
      RAISE EXCEPTION 'Member does not belong to this organization';
    END IF;
    INSERT INTO public.attendance_records(organization_id, session_id, member_id, status, recorded_by,
        check_in_method, client_ref)
    VALUES (target_org, p_session, (item->>'member_id')::uuid, item->>'status', auth.uid(),
        COALESCE(NULLIF(item->>'method', ''), 'manual'), NULLIF(item->>'client_ref', ''))
    ON CONFLICT (session_id, member_id) DO UPDATE
      SET status = excluded.status, recorded_by = auth.uid()
      WHERE public.attendance_records.status IS DISTINCT FROM excluded.status;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

DROP FUNCTION IF EXISTS public.start_qr_checkin(uuid, uuid, integer);
CREATE FUNCTION public.start_qr_checkin(target_org uuid, p_session uuid, ttl_minutes integer DEFAULT 120)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE raw text; exp timestamptz;
BEGIN
  IF NOT private.has_permission(target_org, 'attendance.manage') THEN
    RAISE EXCEPTION 'Permission required' USING ERRCODE='42501';
  END IF;
  IF ttl_minutes NOT BETWEEN 5 AND 720 THEN RAISE EXCEPTION 'Invalid duration'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.attendance_sessions
                  WHERE id = p_session AND organization_id = target_org AND archived_at IS NULL) THEN
    RAISE EXCEPTION 'Session unavailable';
  END IF;
  raw := encode(extensions.gen_random_bytes(32), 'hex');
  exp := now() + make_interval(mins => ttl_minutes);
  UPDATE public.attendance_sessions
     SET qr_secret_hash = encode(extensions.digest(raw, 'sha256'), 'hex'), qr_token = NULL, qr_expires_at = exp
   WHERE id = p_session;
  RETURN jsonb_build_object('secret', raw, 'expires_at', exp, 'session_id', p_session);
END $$;

DROP FUNCTION IF EXISTS public.qr_session_status(uuid, uuid, text);
CREATE FUNCTION public.qr_session_status(target_org uuid, p_session uuid, secret text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE s record;
BEGIN
  IF NOT private.is_org_member(target_org) THEN RAISE EXCEPTION 'Permission required' USING ERRCODE='42501'; END IF;
  SELECT id, title, session_date, qr_expires_at, archived_at, closed_at INTO s
    FROM public.attendance_sessions
   WHERE id = p_session AND organization_id = target_org
     AND qr_secret_hash = encode(extensions.digest(coalesce(secret, ''), 'sha256'), 'hex');
  IF s.id IS NULL THEN RAISE EXCEPTION 'This check-in code is not valid' USING ERRCODE='42501'; END IF;
  IF s.qr_expires_at IS NULL OR s.qr_expires_at <= now() THEN
    RAISE EXCEPTION 'This check-in code has expired';
  END IF;
  IF s.closed_at IS NOT NULL THEN RAISE EXCEPTION 'Check-in is closed'; END IF;
  RETURN jsonb_build_object('session_id', s.id, 'title', s.title, 'session_date', s.session_date,
      'expires_at', s.qr_expires_at);
END $$;

DROP FUNCTION IF EXISTS public.self_check_in(uuid, uuid, text);
CREATE FUNCTION public.self_check_in(target_org uuid, p_session uuid, secret text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE s record; m uuid; existing text;
BEGIN
  IF NOT private.verified_account() THEN RAISE EXCEPTION 'Verify your account first' USING ERRCODE='42501'; END IF;
  SELECT id, qr_expires_at, closed_at, archived_at INTO s
    FROM public.attendance_sessions
   WHERE id = p_session AND organization_id = target_org
     AND qr_secret_hash = encode(extensions.digest(coalesce(secret, ''), 'sha256'), 'hex');
  IF s.id IS NULL THEN RAISE EXCEPTION 'This check-in code is not valid' USING ERRCODE='42501'; END IF;
  IF s.qr_expires_at IS NULL OR s.qr_expires_at <= now() OR s.closed_at IS NOT NULL OR s.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Check-in is closed';
  END IF;
  SELECT id INTO m FROM public.members
   WHERE organization_id = target_org AND linked_user_id = auth.uid() AND archived_at IS NULL LIMIT 1;
  IF m IS NULL THEN RAISE EXCEPTION 'No member record is linked to your account' USING ERRCODE='42501'; END IF;
  SELECT status INTO existing FROM public.attendance_records WHERE session_id = p_session AND member_id = m;
  IF existing IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_recorded', 'attendance_status', existing);
  END IF;
  INSERT INTO public.attendance_records(organization_id, session_id, member_id, status, recorded_by, check_in_method)
  VALUES (target_org, p_session, m, 'present', auth.uid(), 'qr');
  RETURN jsonb_build_object('status', 'checked_in');
END $$;

CREATE OR REPLACE FUNCTION public.set_pastoral_note(target_org uuid, p_member uuid, body text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT private.has_permission(target_org, 'member.notes.manage') THEN
    RAISE EXCEPTION 'Permission required' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.members WHERE id = p_member AND organization_id = target_org) THEN
    RAISE EXCEPTION 'Member not found';
  END IF;
  INSERT INTO private.member_pastoral_notes(member_id, organization_id, body, updated_by, updated_at)
  VALUES (p_member, target_org, body, auth.uid(), now())
  ON CONFLICT (member_id) DO UPDATE
    SET body = excluded.body, updated_by = auth.uid(), updated_at = now();
  INSERT INTO public.audit_logs(organization_id, user_id, action, resource_type, resource_id)
  VALUES (target_org, auth.uid(), 'member.pastoral_note_updated', 'member', p_member);
END $$;

CREATE OR REPLACE FUNCTION public.get_pastoral_note(target_org uuid, p_member uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE body text;
BEGIN
  IF NOT private.has_permission(target_org, 'member.notes.view') THEN
    RAISE EXCEPTION 'Permission required' USING ERRCODE='42501';
  END IF;
  SELECT n.body INTO body FROM private.member_pastoral_notes n
   WHERE n.member_id = p_member AND n.organization_id = target_org;
  RETURN body;
END $$;

CREATE OR REPLACE FUNCTION public.archive_member(target_org uuid, p_member uuid, reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NOT private.has_permission(target_org, 'member.archive') THEN
    RAISE EXCEPTION 'Permission required' USING ERRCODE='42501';
  END IF;
  UPDATE public.members SET status = 'archived', archived_at = now(), updated_at = now()
   WHERE id = p_member AND organization_id = target_org AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found or already archived'; END IF;
  INSERT INTO public.audit_logs(organization_id, user_id, action, resource_type, resource_id, details)
  VALUES (target_org, auth.uid(), 'member.archived', 'member', p_member,
      jsonb_build_object('reason', reason));
END $$;

DROP FUNCTION IF EXISTS public.convert_visitor(uuid, uuid, text, text);
CREATE FUNCTION public.convert_visitor(target_org uuid, p_visitor uuid, first_name text, last_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v public.visitors; result uuid;
BEGIN
  IF NOT private.has_permission(target_org, 'member.create')
     OR NOT private.has_permission(target_org, 'visitor.manage') THEN
    RAISE EXCEPTION 'Permission required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v FROM public.visitors
   WHERE id = p_visitor AND organization_id = target_org FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Visitor not found'; END IF;
  IF v.converted_member_id IS NOT NULL THEN RETURN v.converted_member_id; END IF;
  IF length(trim(coalesce(first_name, ''))) < 1 OR length(trim(coalesce(last_name, ''))) < 1 THEN
    RAISE EXCEPTION 'First and last names are required';
  END IF;
  INSERT INTO public.members(organization_id, branch_id, first_name, last_name, email, phone, joined_on,
      status, created_by)
  VALUES (target_org, v.branch_id, trim(first_name), trim(last_name), v.email, v.phone, current_date,
      'active', auth.uid())
  RETURNING id INTO result;
  UPDATE public.visitors
     SET converted_member_id = result, converted_to_member = true, member_id = result, followup_status = 'converted'
   WHERE id = p_visitor;
  INSERT INTO public.audit_logs(organization_id, user_id, action, resource_type, resource_id, details)
  VALUES (target_org, auth.uid(), 'visitor.converted', 'visitor', p_visitor,
      jsonb_build_object('member_id', result));
  RETURN result;
END $$;

DROP FUNCTION IF EXISTS public.register_event(uuid, uuid, uuid);
CREATE FUNCTION public.register_event(target_org uuid, p_event uuid, p_member uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE e public.events; result uuid;
BEGIN
  IF NOT private.has_permission(target_org, 'event.manage') THEN
    RAISE EXCEPTION 'Permission required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO e FROM public.events WHERE id = p_event AND organization_id = target_org FOR UPDATE;
  IF e.id IS NULL OR e.status <> 'scheduled' OR e.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Event unavailable';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.members
                  WHERE id = p_member AND organization_id = target_org AND archived_at IS NULL) THEN
    RAISE EXCEPTION 'Member not found';
  END IF;
  SELECT id INTO result FROM public.event_registrations WHERE event_id = p_event AND member_id = p_member;
  IF result IS NOT NULL THEN RETURN result; END IF;
  IF e.capacity IS NOT NULL
     AND (SELECT count(*) FROM public.event_registrations WHERE event_id = p_event) >= e.capacity THEN
    RAISE EXCEPTION 'Event is full';
  END IF;
  INSERT INTO public.event_registrations(organization_id, event_id, member_id)
  VALUES (target_org, p_event, p_member) RETURNING id INTO result;
  RETURN result;
END $$;

DROP FUNCTION IF EXISTS public.recurring_absentees(uuid, date, date);
CREATE FUNCTION public.recurring_absentees(target_org uuid, p_from date, p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE result jsonb; total integer;
BEGIN
  IF NOT private.has_permission(target_org, 'attendance.view') THEN
    RAISE EXCEPTION 'Permission required' USING ERRCODE='42501';
  END IF;
  SELECT count(*) INTO total FROM public.attendance_sessions
   WHERE organization_id = target_org AND session_date BETWEEN p_from AND p_to AND archived_at IS NULL;
  IF total = 0 THEN RETURN '[]'::jsonb; END IF;
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO result FROM (
    SELECT m.id, m.first_name, m.last_name,
      (SELECT count(*) FROM public.attendance_records ar
        WHERE ar.member_id = m.id AND ar.status = 'present'
          AND ar.session_id IN (SELECT id FROM public.attendance_sessions
                                 WHERE organization_id = target_org AND session_date BETWEEN p_from AND p_to)) AS attended
      FROM public.members m
     WHERE m.organization_id = target_org AND m.status = 'active' AND m.archived_at IS NULL
     ORDER BY m.first_name LIMIT 200) t
  WHERE t.attended = 0;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.am_i_platform_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT private.is_platform_admin();
$$;

GRANT EXECUTE ON FUNCTION
  public.create_workspace(uuid, jsonb), public.accept_invitation(text), public.my_permissions(uuid),
  public.invite_staff(uuid, text, text, uuid[]), public.revoke_invitation(uuid, uuid),
  public.change_membership(uuid, uuid, text, text), public.workspace_summary(uuid, date, date),
  public.record_attendance(uuid, uuid, jsonb), public.start_qr_checkin(uuid, uuid, integer),
  public.qr_session_status(uuid, uuid, text), public.self_check_in(uuid, uuid, text),
  public.set_pastoral_note(uuid, uuid, text), public.get_pastoral_note(uuid, uuid),
  public.archive_member(uuid, uuid, text), public.convert_visitor(uuid, uuid, text, text),
  public.register_event(uuid, uuid, uuid), public.recurring_absentees(uuid, date, date),
  public.am_i_platform_admin()
TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_workspace(uuid, jsonb) FROM anon;

-- ----------------------------------------------------------------------------
-- 8. Retire functions whose dependencies no longer exist (destroyed by the
--    2026-10-28 full_cleanup). Re-introduce with their tables when rebuilt.
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
-- 9. Indexes for tenant-scoped access paths
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
