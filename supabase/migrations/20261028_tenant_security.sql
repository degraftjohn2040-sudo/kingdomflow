-- ============================================================================
-- KingdomFlow — 20261028_tenant_security.sql
-- Restores the multi-tenant security model after the 2026-10-28 "full_cleanup"
-- and "create_all_tables" migrations replaced the schema while leaving the
-- SECURITY DEFINER layer in place. Every RPC below references objects that the
-- cleanup had deleted, so the application was non-functional until this ran.
--
-- Pre-existing helpers this migration depends on (verified present before it
-- was applied, not redefined here): private.has_permission, private.has_org_role,
-- private.is_org_member, private.verified_account, private.is_platform_admin,
-- private.has_feature, private.audit_change, private.guard_membership_change,
-- private.guard_profile_flags, private.handle_new_user, private.limit_workspace_creation,
-- public.log_audit_action.
--
-- Applied to project ivglimtjzcdfyflscngh on 2026-10-28. Idempotent: safe to
-- re-run. Verified by supabase/tests/tenant_isolation.sql (30 assertions) and
-- supabase/tests/privilege_escalation.sql (6 assertions).
-- ============================================================================

-- ---------------------------------------------------------------- 1. schema
-- Drop every ad-hoc policy first: they are replaced wholesale in section 4.
do $$
declare p record;
begin
  for p in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- Restore the names the RPC layer expects.
alter table if exists public.organization_members rename to organization_memberships;
alter table if exists public.giving_records rename to contributions;
alter table if exists public.follow_ups rename to followups;
alter table if exists public.follow_up_notes rename to followup_notes;
alter table if exists public.subscription_plans rename to plans;

alter table public.organization_memberships
  add column if not exists status text,
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists last_active_at timestamptz;
update public.organization_memberships
   set status = case when coalesce(is_active, true) then 'active' else 'suspended' end
 where status is null;
alter table public.organization_memberships
  alter column status set default 'active',
  alter column status set not null,
  drop column if exists is_active;

alter table public.organizations
  add column if not exists created_by uuid,
  add column if not exists organization_type text default 'church',
  add column if not exists onboarding_complete boolean not null default false,
  add column if not exists setup_request_key uuid,
  add column if not exists denomination text;
create unique index if not exists organizations_setup_key_uniq
  on public.organizations(created_by, setup_request_key) where setup_request_key is not null;

alter table public.profiles
  add column if not exists onboarding_draft jsonb not null default '{}'::jsonb,
  add column if not exists last_org_id uuid;

alter table public.members
  add column if not exists joined_on date,
  add column if not exists archived_at timestamptz,
  add column if not exists consent_communications boolean not null default true;
update public.members set joined_on = join_date where joined_on is null;

alter table public.events
  add column if not exists capacity integer,
  add column if not exists archived_at timestamptz;
alter table public.departments add column if not exists archived_at timestamptz;
alter table public.branches add column if not exists archived_at timestamptz;

alter table public.attendance_sessions
  add column if not exists archived_at timestamptz,
  add column if not exists qr_secret_hash text,
  add column if not exists closed_at timestamptz;

alter table public.attendance_records
  add column if not exists organization_id uuid,
  add column if not exists status text not null default 'present',
  add column if not exists recorded_by uuid,
  add column if not exists client_ref text;
update public.attendance_records r
   set organization_id = s.organization_id
  from public.attendance_sessions s
 where s.id = r.session_id and r.organization_id is null;
create unique index if not exists attendance_records_session_member_uniq
  on public.attendance_records(session_id, member_id);
create unique index if not exists attendance_records_client_ref_uniq
  on public.attendance_records(session_id, client_ref) where client_ref is not null;

alter table public.visitors
  add column if not exists converted_member_id uuid,
  add column if not exists followup_status text default 'new';
update public.visitors set converted_member_id = member_id
 where converted_member_id is null and member_id is not null;

-- ------------------------------------------------------- 2. permission matrix
create table if not exists public.role_permissions (
  role text not null,
  permission text not null,
  primary key (role, permission)
);
alter table public.role_permissions enable row level security;

-- owner: everything. admin: operations without money or pastoral notes.
-- senior_pastor: ministry + read-only finance. finance_officer: money only.
insert into public.role_permissions(role, permission)
select 'owner', p from unnest(array[
  'org.view','org.manage','org.audit_logs','plan.manage','branch.view','branch.manage',
  'member.view','member.create','member.update','member.archive','member.export','member.import',
  'member.notes.view','member.notes.manage','staff.view','staff.manage','attendance.view',
  'attendance.manage','event.view','event.manage','form.view','form.manage','finance.view',
  'finance.manage','department.view','department.manage','report.view','report.export',
  'communication.view','communication.manage','followup.view','followup.manage','visitor.view',
  'visitor.manage','task.view','task.manage','prayer.view','prayer.manage']) p
union all select 'admin', p from unnest(array[
  'org.view','org.manage','org.audit_logs','branch.view','branch.manage','member.view','member.create',
  'member.update','member.archive','member.export','member.import','member.notes.view',
  'member.notes.manage','staff.view','staff.manage','attendance.view','attendance.manage','event.view',
  'event.manage','form.view','form.manage','department.view','department.manage','report.view',
  'report.export','communication.view','communication.manage','followup.view','followup.manage',
  'visitor.view','visitor.manage','task.view','task.manage','prayer.view','prayer.manage']) p
union all select 'senior_pastor', p from unnest(array[
  'org.view','org.audit_logs','branch.view','branch.manage','member.view','member.create','member.update',
  'member.archive','member.export','member.import','member.notes.view','member.notes.manage','staff.view',
  'staff.manage','attendance.view','attendance.manage','event.view','event.manage','form.view','form.manage',
  'finance.view','department.view','department.manage','report.view','report.export','communication.view',
  'communication.manage','followup.view','followup.manage','visitor.view','visitor.manage','task.view',
  'task.manage','prayer.view','prayer.manage']) p
union all select 'pastor', p from unnest(array[
  'org.view','branch.view','member.view','member.create','member.update','member.notes.view',
  'member.notes.manage','member.export','staff.view','attendance.view','attendance.manage','event.view',
  'event.manage','form.view','form.manage','department.view','report.view','communication.view',
  'followup.view','followup.manage','visitor.view','visitor.manage','task.view','task.manage',
  'prayer.view','prayer.manage']) p
union all select 'secretary', p from unnest(array[
  'org.view','branch.view','member.view','member.create','member.update','member.import','member.export',
  'staff.view','attendance.view','attendance.manage','event.view','event.manage','form.view','form.manage',
  'department.view','report.view','communication.view','communication.manage','task.view','task.manage',
  'prayer.view','followup.view','visitor.view']) p
union all select 'finance_officer', p from unnest(array[
  'org.view','branch.view','finance.view','finance.manage','member.view','report.view','report.export',
  'event.view']) p
union all select 'department_leader', p from unnest(array[
  'org.view','branch.view','member.view','attendance.view','attendance.manage','event.view','event.manage',
  'department.view','report.view','communication.view','task.view','task.manage','followup.view',
  'prayer.view','form.view']) p
union all select 'followup_officer', p from unnest(array[
  'org.view','branch.view','member.view','member.update','member.notes.view','member.notes.manage',
  'visitor.view','visitor.manage','followup.view','followup.manage','task.view','task.manage','prayer.view',
  'attendance.view','report.view']) p
union all select 'viewer', p from unnest(array[
  'org.view','branch.view','member.view','attendance.view','event.view','department.view','report.view',
  'prayer.view','form.view']) p
on conflict (role, permission) do nothing;

-- --------------------------------------------------- 3. plans and billing
alter table public.plans add column if not exists marketing_features jsonb not null default '[]'::jsonb;
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'plans'
                and column_name = 'features' and data_type = 'jsonb') then
    execute 'update public.plans set marketing_features = features';
    execute 'alter table public.plans drop column features';
  end if;
end $$;
alter table public.plans add column if not exists features text[] not null default '{}';
update public.plans set features = case slug
  when 'free' then array['core','members','attendance','forms','announcements','followups']
  when 'pro'  then array['core','members','attendance','forms','announcements','followups','email','sms','reports','import_export','multi_branch']
  else array['core','members','attendance','forms','announcements','followups','email','sms','reports','import_export','multi_branch','ai','branding','priority_support'] end
 where features is null or cardinality(features) = 0;

create table if not exists public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  plan uuid not null references public.plans(id),
  status text not null default 'trialing',
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null default 'infinity',
  created_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
insert into public.subscriptions(organization_id, plan, status, ends_at)
select o.id, (select id from public.plans where slug = 'free'), 'active', 'infinity'
  from public.organizations o
 where not exists (select 1 from public.subscriptions s where s.organization_id = o.id);

-- ------------------------------------------- 4. invitations, registrations, notes
create table if not exists public.organization_invitations (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null default 'viewer',
  branch_ids uuid[] not null default '{}',
  invited_by uuid not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.organization_invitations enable row level security;

create table if not exists public.event_registrations (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  status text not null default 'registered',
  created_at timestamptz not null default now(),
  unique (event_id, member_id)
);
alter table public.event_registrations enable row level security;

-- Pastoral notes are unreachable through PostgREST: only the gated RPCs below.
create table if not exists private.member_pastoral_notes (
  member_id uuid primary key references public.members(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  body text not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table private.member_pastoral_notes enable row level security;
insert into private.member_pastoral_notes(member_id, organization_id, body)
select id, organization_id, notes from public.members
 where notes is not null and length(trim(notes)) > 0
on conflict (member_id) do nothing;
alter table public.members drop column if exists notes;

alter table public.attendance_sessions drop constraint if exists attendance_sessions_qr_token_key;

-- ------------------------------------------------------------ 5. helpers
create or replace function private.has_branch_access(target_org uuid, target_branch uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select target_branch is null or exists (
    select 1 from public.organization_memberships m
    where m.organization_id = target_org and m.user_id = auth.uid() and m.status = 'active'
      and (m.branch_ids is null or cardinality(m.branch_ids) = 0 or target_branch = any(m.branch_ids)));
$$;

create or replace function public.auto_assign_free_plan() returns trigger
language plpgsql set search_path to '' as $$
begin
  if new.plan_id is null then new.plan_id := (select id from public.plans where slug = 'free'); end if;
  return new;
end $$;

create or replace function private.assign_default_plan() returns trigger
language plpgsql security definer set search_path to '' as $$
declare p uuid;
begin
  select id into p from public.plans where slug = 'free' limit 1;
  if p is not null then
    insert into public.subscriptions(organization_id, plan, status, ends_at)
    values (new.id, p, 'active', 'infinity') on conflict (organization_id) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists trg_assign_default_plan on public.organizations;
create trigger trg_assign_default_plan after insert on public.organizations
  for each row execute function private.assign_default_plan();

create or replace function public.update_org_contact_count() returns trigger
language plpgsql security definer set search_path to '' as $$
declare oid uuid;
begin
  oid := coalesce(new.organization_id, old.organization_id);
  if oid is not null then
    update public.organizations
       set contact_count = (select count(*) from public.members
                             where organization_id = oid and status <> 'archived')
     where id = oid;
  end if;
  return null;
end $$;

create or replace function private.guard_membership_change() returns trigger
language plpgsql security definer set search_path to '' as $$
declare actor_role text;
begin
  select role into actor_role from public.organization_memberships
   where organization_id = new.organization_id and user_id = auth.uid() and status = 'active';
  if new.user_id = auth.uid() and actor_role <> 'owner'
     and (new.role is distinct from old.role or new.status is distinct from old.status) then
    raise exception 'You cannot change your own role or access' using errcode = '42501';
  end if;
  if new.role = 'owner' and old.role <> 'owner' and actor_role <> 'owner' then
    raise exception 'Only an owner can grant ownership' using errcode = '42501';
  end if;
  if old.role = 'owner' and new.role <> 'owner'
     and (select count(*) from public.organization_memberships
           where organization_id = old.organization_id and role = 'owner' and status = 'active') <= 1 then
    raise exception 'An organization must keep at least one owner' using errcode = '42501';
  end if;
  if new.role not in (select distinct role from public.role_permissions) then
    raise exception 'Unknown role';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_membership on public.organization_memberships;
create trigger trg_guard_membership before update on public.organization_memberships
  for each row execute function private.guard_membership_change();

create or replace function private.guard_profile_flags() returns trigger
language plpgsql set search_path to '' as $$
begin
  if new.is_platform_admin is distinct from old.is_platform_admin
     and current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'Platform privileges cannot be self-assigned' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_profile_flags on public.profiles;
create trigger trg_guard_profile_flags before update on public.profiles
  for each row execute function private.guard_profile_flags();

-- Secrets are never selectable by a client, whatever their row-level access.
revoke select (qr_secret_hash) on public.attendance_sessions from anon, authenticated;
revoke select (textbee_api_key_encrypted, whatsapp_business_api_key_encrypted)
  on public.org_communication_settings from anon, authenticated;

-- ------------------------------------------------------------ 6. policies
do $$
declare cfg record; c text; b text;
begin
  for cfg in select * from (values
    ('members','organization_id','branch_id','member.view','member.create','member.update'),
    ('branches','organization_id',null,'branch.view','branch.manage','branch.manage'),
    ('departments','organization_id','branch_id','department.view','department.manage','department.manage'),
    ('events','organization_id','branch_id','event.view','event.manage','event.manage'),
    ('event_registrations','organization_id',null,'event.view','event.manage','event.manage'),
    ('attendance_sessions','organization_id','branch_id','attendance.view','attendance.manage','attendance.manage'),
    ('attendance_records','organization_id',null,'attendance.view','attendance.manage','attendance.manage'),
    ('forms','organization_id',null,'form.view','form.manage','form.manage'),
    ('form_submissions','organization_id',null,'form.view','form.manage','form.manage'),
    ('announcements','organization_id','branch_id','communication.view','communication.manage','communication.manage'),
    ('campaigns','organization_id',null,'communication.view','communication.manage','communication.manage'),
    ('communication_templates','organization_id',null,'communication.view','communication.manage','communication.manage'),
    ('followups','organization_id','branch_id','followup.view','followup.manage','followup.manage'),
    ('visitors','organization_id','branch_id','visitor.view','visitor.manage','visitor.manage'),
    ('tasks','organization_id','branch_id','task.view','task.manage','task.manage'),
    ('prayer_requests','organization_id','branch_id','prayer.view','prayer.manage','prayer.manage'),
    ('contributions','organization_id','branch_id','finance.view','finance.manage','finance.manage'),
    ('expense_records','organization_id','branch_id','finance.view','finance.manage','finance.manage')
  ) as t(tbl, org, br, sel, ins, upd)
  loop
    execute format('alter table public.%I enable row level security', cfg.tbl);
    b := case when cfg.br is null then ''
              else format(' and (%I is null or private.has_branch_access(%I, %I))', cfg.br, cfg.org, cfg.br) end;
    execute format('create policy %I on public.%I for select to authenticated using (%s)',
      cfg.tbl || '_select', cfg.tbl, format('private.has_permission(%I, %L)%s', cfg.org, cfg.sel, b));
    c := format('private.has_permission(%I, %L)%s', cfg.org, cfg.ins, b);
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)',
      cfg.tbl || '_insert', cfg.tbl, c);
    c := format('private.has_permission(%I, %L)%s', cfg.org, cfg.upd, b);
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)',
      cfg.tbl || '_update', cfg.tbl, c, c);
  end loop;
end $$;

alter table public.department_members enable row level security;
create policy department_members_select on public.department_members for select to authenticated using (
  exists (select 1 from public.departments d where d.id = department_id
    and private.has_permission(d.organization_id, 'department.view')));
create policy department_members_write on public.department_members for insert to authenticated with check (
  exists (select 1 from public.departments d where d.id = department_id
    and private.has_permission(d.organization_id, 'department.manage')));
create policy department_members_update on public.department_members for update to authenticated using (
  exists (select 1 from public.departments d where d.id = department_id
    and private.has_permission(d.organization_id, 'department.manage')));
create policy department_members_delete on public.department_members for delete to authenticated using (
  exists (select 1 from public.departments d where d.id = department_id
    and private.has_permission(d.organization_id, 'department.manage')));

alter table public.followup_notes enable row level security;
create policy followup_notes_select on public.followup_notes for select to authenticated using (
  exists (select 1 from public.followups f where f.id = follow_up_id
    and private.has_permission(f.organization_id, 'followup.view')));
create policy followup_notes_insert on public.followup_notes for insert to authenticated with check (
  exists (select 1 from public.followups f where f.id = follow_up_id
    and private.has_permission(f.organization_id, 'followup.manage')));

alter table public.campaign_recipients enable row level security;
create policy campaign_recipients_select on public.campaign_recipients for select to authenticated using (
  exists (select 1 from public.campaigns c where c.id = campaign_id
    and private.has_permission(c.organization_id, 'communication.view')));
create policy campaign_recipients_insert on public.campaign_recipients for insert to authenticated with check (
  exists (select 1 from public.campaigns c where c.id = campaign_id
    and private.has_permission(c.organization_id, 'communication.manage')));

alter table public.organizations enable row level security;
create policy organizations_select on public.organizations for select to authenticated
  using (private.is_org_member(id));
create policy organizations_update on public.organizations for update to authenticated
  using (private.has_permission(id, 'org.manage'))
  with check (private.has_permission(id, 'org.manage'));

alter table public.organization_memberships enable row level security;
create policy memberships_select on public.organization_memberships for select to authenticated
  using (user_id = auth.uid() or private.has_permission(organization_id, 'staff.view'));
create policy memberships_insert on public.organization_memberships for insert to authenticated
  with check (private.has_permission(organization_id, 'staff.manage'));
create policy memberships_update on public.organization_memberships for update to authenticated
  using (private.has_permission(organization_id, 'staff.manage'))
  with check (private.has_permission(organization_id, 'staff.manage'));
create policy memberships_delete on public.organization_memberships for delete to authenticated
  using (private.has_permission(organization_id, 'staff.manage'));

alter table public.organization_invitations enable row level security;
create policy invitations_select on public.organization_invitations for select to authenticated
  using (private.has_permission(organization_id, 'staff.manage'));

alter table public.profiles enable row level security;
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

alter table public.notifications enable row level security;
create policy notifications_select_own on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update_own on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.user_gmail_tokens enable row level security;
create policy gmail_tokens_own on public.user_gmail_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.audit_logs enable row level security;
create policy audit_logs_select on public.audit_logs for select to authenticated
  using (private.has_permission(organization_id, 'org.audit_logs'));

alter table public.subscriptions enable row level security;
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (private.is_org_member(organization_id));

alter table public.plans enable row level security;
create policy plans_select_public on public.plans for select to anon, authenticated using (is_active);

alter table public.role_permissions enable row level security;
create policy role_permissions_select on public.role_permissions for select to authenticated using (true);

alter table public.org_communication_settings enable row level security;
create policy comm_settings_manage on public.org_communication_settings for all to authenticated
  using (private.has_permission(organization_id, 'org.manage'))
  with check (private.has_permission(organization_id, 'org.manage'));

grant execute on all functions in schema private to authenticated;

-- --------------------------------------------------------------- 7. RPCs
-- Workspace onboarding. Idempotent on (created_by, setup_request_key).
create or replace function public.create_workspace(request_key uuid, setup jsonb)
returns uuid language plpgsql security definer set search_path to '' as $$
declare org_id uuid; org_slug text; dept text; p uuid; actor_email text; actor_name text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not private.verified_account() then
    raise exception 'Verify your email address before creating a workspace' using errcode = '42501';
  end if;
  if request_key is null then raise exception 'A request key is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 2));
  select id into org_id from public.organizations
   where created_by = auth.uid() and setup_request_key = request_key;
  if org_id is not null then return org_id; end if;
  if jsonb_typeof(setup) is distinct from 'object' then raise exception 'Invalid setup payload'; end if;
  if length(trim(coalesce(setup->>'name', ''))) not between 2 and 120 then
    raise exception 'Enter your church or ministry name';
  end if;
  if not exists (select 1 from pg_timezone_names where name = setup->>'timezone') then
    raise exception 'Choose a valid timezone';
  end if;
  if jsonb_typeof(setup->'departments') is distinct from 'array'
     or jsonb_array_length(setup->'departments') > 20 then
    raise exception 'Add at most 20 departments';
  end if;
  if (select count(*) from public.organizations where created_by = auth.uid()) >= 5 then
    raise exception 'Workspace limit reached';
  end if;

  select email into actor_email from auth.users where id = auth.uid();
  update public.profiles
     set full_name = coalesce(nullif(trim(setup->>'full_name'), ''), full_name),
         phone = nullif(trim(setup->>'profile_phone'), ''),
         onboarding_draft = '{}'::jsonb
   where id = auth.uid()
  returning full_name into actor_name;

  org_slug := trim(both '-' from left(regexp_replace(lower(setup->>'name'), '[^a-z0-9]+', '-', 'g'), 60));
  org_slug := coalesce(nullif(org_slug, ''), 'church') || '-' ||
              substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  insert into public.organizations(name, slug, organization_type, country, timezone, currency, city, phone,
      email, denomination, created_by, onboarding_complete, setup_request_key, plan)
  values (trim(setup->>'name'), org_slug, coalesce(nullif(setup->>'organization_type', ''), 'church'),
      coalesce(nullif(setup->>'country', ''), 'GH'), setup->>'timezone',
      coalesce(nullif(setup->>'currency', ''), 'GHS'), nullif(trim(setup->>'city'), ''),
      nullif(trim(setup->>'phone'), ''), nullif(trim(setup->>'email'), ''),
      nullif(trim(setup->>'denomination'), ''), auth.uid(), true, request_key, 'free')
  returning id into org_id;

  insert into public.organization_memberships(organization_id, user_id, role, status, full_name, email, joined_at)
  values (org_id, auth.uid(), 'owner', 'active', actor_name, actor_email, now());

  select id into p from public.plans where slug = 'free' limit 1;
  if p is not null then
    insert into public.subscriptions(organization_id, plan, status, ends_at)
    values (org_id, p, 'active', 'infinity') on conflict (organization_id) do nothing;
  end if;

  insert into public.branches(organization_id, name, slug, is_main, status, city)
  values (org_id, coalesce(nullif(trim(setup->>'branch_name'), ''), 'Main Campus'), 'main-campus', true,
      'active', nullif(trim(setup->>'city'), ''));

  for dept in select trim(value) from jsonb_array_elements_text(setup->'departments') loop
    if length(dept) between 2 and 80 then
      insert into public.departments(organization_id, name, slug)
      values (org_id, dept, trim(both '-' from regexp_replace(lower(dept), '[^a-z0-9]+', '-', 'g')));
    end if;
  end loop;

  insert into public.audit_logs(organization_id, user_id, action, resource_type, resource_id)
  values (org_id, auth.uid(), 'workspace.created', 'organization', org_id);
  return org_id;
end $$;

-- Invitation acceptance. Token is hashed; email must match the verified account.
create or replace function public.accept_invitation(invitation_token text)
returns uuid language plpgsql security definer set search_path to '' as $$
declare invite public.organization_invitations; verified_email text; existing text;
begin
  if not private.verified_account() then raise exception 'Verify your account first' using errcode = '42501'; end if;
  if invitation_token is null or invitation_token !~ '^[a-f0-9]{64}$' then
    raise exception 'Invitation unavailable' using errcode = '42501';
  end if;
  select lower(email) into verified_email from auth.users
   where id = auth.uid() and email_confirmed_at is not null;
  select * into invite from public.organization_invitations
   where token_hash = encode(extensions.digest(invitation_token, 'sha256'), 'hex');
  if invite.id is null then raise exception 'Invitation unavailable' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(invite.organization_id::text, 7));
  select * into invite from public.organization_invitations where id = invite.id for update;
  if invite.expires_at <= now() or invite.accepted_at is not null or invite.revoked_at is not null
     or lower(invite.email) is distinct from verified_email then
    raise exception 'This invitation is no longer valid' using errcode = '42501';
  end if;
  select status into existing from public.organization_memberships
   where organization_id = invite.organization_id and user_id = auth.uid();
  if existing is not null then raise exception 'You already belong to this workspace'; end if;
  insert into public.organization_memberships(organization_id, user_id, role, status, branch_ids,
      invited_by, invited_at, joined_at, email)
  values (invite.organization_id, auth.uid(), invite.role, 'active', invite.branch_ids, invite.invited_by,
      invite.created_at, now(), verified_email);
  update public.organization_invitations set accepted_at = now() where id = invite.id;
  insert into public.audit_logs(organization_id, user_id, action, resource_type, details)
  values (invite.organization_id, auth.uid(), 'staff.joined', 'organization_membership',
      jsonb_build_object('role', invite.role));
  return invite.organization_id;
end $$;

create or replace function public.my_permissions(target_org uuid) returns setof text
language sql stable security definer set search_path to '' as $$
  select m.role || ':' || rp.permission
    from public.organization_memberships m
    join public.role_permissions rp on rp.role = m.role
   where m.organization_id = target_org and m.user_id = auth.uid() and m.status = 'active';
$$;

create or replace function public.am_i_platform_admin() returns boolean
language sql stable security definer set search_path to '' as $$
  select private.is_platform_admin();
$$;

-- Cannot invite above your own authority; owner role is never invitable.
create or replace function public.invite_staff(target_org uuid, p_email text, p_role text,
    p_branch_ids uuid[] default '{}') returns jsonb
language plpgsql security definer set search_path to '' as $$
declare raw text; rec public.organization_invitations; actor_role text; perms text[]; target_perms text[];
begin
  if not private.has_permission(target_org, 'staff.manage') then
    raise exception 'Permission required' using errcode = '42501';
  end if;
  if p_email is null or lower(trim(p_email)) !~ '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' then
    raise exception 'Enter a valid email address';
  end if;
  select role into actor_role from public.organization_memberships
   where organization_id = target_org and user_id = auth.uid() and status = 'active';
  if not exists (select 1 from public.role_permissions where role = p_role) or p_role = 'owner' then
    raise exception 'Choose a valid role';
  end if;
  if actor_role <> 'owner' and p_role in ('admin', 'senior_pastor') then
    raise exception 'Only an owner can invite that role' using errcode = '42501';
  end if;
  if actor_role <> 'owner' then
    select array_agg(permission) into perms from public.role_permissions where role = actor_role;
    select array_agg(permission) into target_perms from public.role_permissions where role = p_role;
    if not (target_perms <@ perms) then
      raise exception 'You cannot grant permissions you do not hold' using errcode = '42501';
    end if;
  end if;
  if exists (select 1 from public.organization_invitations
              where organization_id = target_org and lower(email) = lower(trim(p_email))
                and accepted_at is null and revoked_at is null and expires_at > now()) then
    raise exception 'An active invitation already exists for that email';
  end if;
  if exists (select 1 from public.organization_memberships m join auth.users u on u.id = m.user_id
              where m.organization_id = target_org and lower(u.email) = lower(trim(p_email))) then
    raise exception 'That person is already on your team';
  end if;
  raw := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.organization_invitations(organization_id, email, role, branch_ids, invited_by,
      token_hash, expires_at)
  values (target_org, lower(trim(p_email)), p_role, coalesce(p_branch_ids, '{}'), auth.uid(),
      encode(extensions.digest(raw, 'sha256'), 'hex'), now() + interval '7 days')
  returning * into rec;
  insert into public.audit_logs(organization_id, user_id, action, resource_type, resource_id, details)
  values (target_org, auth.uid(), 'staff.invited', 'organization_invitation', rec.id,
      jsonb_build_object('email', rec.email, 'role', rec.role));
  return jsonb_build_object('id', rec.id, 'token', raw, 'expires_at', rec.expires_at,
      'email', rec.email, 'role', rec.role);
end $$;

create or replace function public.revoke_invitation(target_org uuid, invitation_id uuid) returns void
language plpgsql security definer set search_path to '' as $$
begin
  if not private.has_permission(target_org, 'staff.manage') then
    raise exception 'Permission required' using errcode = '42501';
  end if;
  update public.organization_invitations set revoked_at = now()
   where id = invitation_id and organization_id = target_org
     and accepted_at is null and revoked_at is null;
  if not found then raise exception 'Invitation not found'; end if;
  insert into public.audit_logs(organization_id, user_id, action, resource_type, resource_id)
  values (target_org, auth.uid(), 'staff.invitation_revoked', 'organization_invitation', invitation_id);
end $$;

create or replace function public.change_membership(target_org uuid, target_user uuid,
    new_role text, new_status text) returns void
language plpgsql security definer set search_path to '' as $$
begin
  if not private.has_permission(target_org, 'staff.manage') then
    raise exception 'Permission required' using errcode = '42501';
  end if;
  if new_status not in ('active', 'suspended') then raise exception 'Invalid status'; end if;
  update public.organization_memberships
     set role = coalesce(new_role, role), status = new_status
   where organization_id = target_org and user_id = target_user;
  if not found then raise exception 'Team member not found'; end if;
  insert into public.audit_logs(organization_id, user_id, action, resource_type, details)
  values (target_org, auth.uid(), 'staff.role_changed', 'organization_membership',
      jsonb_build_object('target_user', target_user, 'role', new_role, 'status', new_status));
end $$;

-- Dashboard aggregates. Finance totals are null unless the caller may see money.
create or replace function public.workspace_summary(target_org uuid,
    p_from date default (current_date - interval '30 days')::date,
    p_to date default current_date) returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare can_finance boolean; result jsonb;
begin
  if not private.has_permission(target_org, 'org.view') then
    raise exception 'Permission required' using errcode = '42501';
  end if;
  can_finance := private.has_permission(target_org, 'finance.view');
  select jsonb_build_object(
    'members_total', (select count(*) from public.members where organization_id = target_org and status <> 'archived'),
    'members_active', (select count(*) from public.members where organization_id = target_org and status = 'active' and archived_at is null),
    'members_new', (select count(*) from public.members where organization_id = target_org and created_at::date between p_from and p_to),
    'visitors', (select count(*) from public.visitors where organization_id = target_org and visit_date between p_from and p_to),
    'sessions', (select count(*) from public.attendance_sessions where organization_id = target_org and session_date between p_from and p_to),
    'attendance_present', (select count(*) from public.attendance_records ar
        join public.attendance_sessions s on s.id = ar.session_id
       where s.organization_id = target_org and s.session_date between p_from and p_to and ar.status = 'present'),
    'open_followups', (select count(*) from public.followups where organization_id = target_org and status = 'open'),
    'open_tasks', (select count(*) from public.tasks where organization_id = target_org and status <> 'done'),
    'upcoming_events', (select count(*) from public.events where organization_id = target_org
        and start_time >= now() and status = 'scheduled' and archived_at is null),
    'branches', (select count(*) from public.branches where organization_id = target_org and status = 'active'),
    'departments', (select count(*) from public.departments where organization_id = target_org and status = 'active'),
    'team', (select count(*) from public.organization_memberships where organization_id = target_org and status = 'active'),
    'contributions_total', case when can_finance then
      (select coalesce(sum(amount), 0) from public.contributions
        where organization_id = target_org and given_at between p_from and p_to) end,
    'expenses_total', case when can_finance then
      (select coalesce(sum(amount), 0) from public.expense_records
        where organization_id = target_org and incurred_at between p_from and p_to) end,
    'can_finance', can_finance,
    'attendance_trend', coalesce((select jsonb_agg(row_to_json(t)) from (
        select s.session_date as day, count(ar.id) filter (where ar.status = 'present') as present
          from public.attendance_sessions s
          left join public.attendance_records ar on ar.session_id = s.id
         where s.organization_id = target_org and s.session_date between p_from and p_to
         group by s.session_date order by s.session_date) t), '[]'::jsonb)
  ) into result;
  return result;
end $$;

-- Idempotent bulk attendance. client_ref makes offline replay safe.
create or replace function public.record_attendance(target_org uuid, p_session uuid, records jsonb)
returns integer language plpgsql security definer set search_path to '' as $$
declare item jsonb; n integer := 0;
begin
  if not private.has_permission(target_org, 'attendance.manage') then
    raise exception 'Permission required' using errcode = '42501';
  end if;
  if jsonb_typeof(records) <> 'array' or jsonb_array_length(records) > 250 then
    raise exception 'Choose at most 250 people';
  end if;
  if not exists (select 1 from public.attendance_sessions
                  where id = p_session and organization_id = target_org and archived_at is null) then
    raise exception 'Session unavailable';
  end if;
  for item in select value from jsonb_array_elements(records) loop
    if (item->>'status') not in ('present', 'absent', 'excused') then
      raise exception 'Invalid attendance status';
    end if;
    if not exists (select 1 from public.members
                    where id = (item->>'member_id')::uuid and organization_id = target_org) then
      raise exception 'Member does not belong to this organization';
    end if;
    insert into public.attendance_records(organization_id, session_id, member_id, status, recorded_by,
        check_in_method, client_ref)
    values (target_org, p_session, (item->>'member_id')::uuid, item->>'status', auth.uid(),
        coalesce(nullif(item->>'method', ''), 'manual'), nullif(item->>'client_ref', ''))
    on conflict (session_id, member_id) do update
      set status = excluded.status, recorded_by = auth.uid()
      where public.attendance_records.status is distinct from excluded.status;
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.start_qr_checkin(target_org uuid, p_session uuid,
    ttl_minutes integer default 120) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare raw text; exp timestamptz;
begin
  if not private.has_permission(target_org, 'attendance.manage') then
    raise exception 'Permission required' using errcode = '42501';
  end if;
  if ttl_minutes not between 5 and 720 then raise exception 'Invalid duration'; end if;
  if not exists (select 1 from public.attendance_sessions
                  where id = p_session and organization_id = target_org and archived_at is null) then
    raise exception 'Session unavailable';
  end if;
  raw := encode(extensions.gen_random_bytes(32), 'hex');
  exp := now() + make_interval(mins => ttl_minutes);
  update public.attendance_sessions
     set qr_secret_hash = encode(extensions.digest(raw, 'sha256'), 'hex'),
         qr_token = null, qr_expires_at = exp
   where id = p_session;
  return jsonb_build_object('secret', raw, 'expires_at', exp, 'session_id', p_session);
end $$;

create or replace function public.qr_session_status(target_org uuid, p_session uuid, secret text)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare s record;
begin
  if not private.is_org_member(target_org) then raise exception 'Permission required' using errcode = '42501'; end if;
  select id, title, session_date, qr_expires_at, archived_at, closed_at into s
    from public.attendance_sessions
   where id = p_session and organization_id = target_org
     and qr_secret_hash = encode(extensions.digest(coalesce(secret, ''), 'sha256'), 'hex');
  if s.id is null then raise exception 'This check-in code is not valid' using errcode = '42501'; end if;
  if s.qr_expires_at is null or s.qr_expires_at <= now() then
    raise exception 'This check-in code has expired';
  end if;
  if s.closed_at is not null then raise exception 'Check-in is closed'; end if;
  return jsonb_build_object('session_id', s.id, 'title', s.title, 'session_date', s.session_date,
      'expires_at', s.qr_expires_at);
end $$;

create or replace function public.self_check_in(target_org uuid, p_session uuid, secret text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare s record; m uuid; existing text;
begin
  if not private.verified_account() then raise exception 'Verify your account first' using errcode = '42501'; end if;
  select id, qr_expires_at, closed_at, archived_at into s
    from public.attendance_sessions
   where id = p_session and organization_id = target_org
     and qr_secret_hash = encode(extensions.digest(coalesce(secret, ''), 'sha256'), 'hex');
  if s.id is null then raise exception 'This check-in code is not valid' using errcode = '42501'; end if;
  if s.qr_expires_at is null or s.qr_expires_at <= now() or s.closed_at is not null or s.archived_at is not null then
    raise exception 'Check-in is closed';
  end if;
  select id into m from public.members
   where organization_id = target_org and linked_user_id = auth.uid() and archived_at is null limit 1;
  if m is null then
    raise exception 'No member record is linked to your account' using errcode = '42501';
  end if;
  select status into existing from public.attendance_records where session_id = p_session and member_id = m;
  if existing is not null then
    return jsonb_build_object('status', 'already_recorded', 'attendance_status', existing);
  end if;
  insert into public.attendance_records(organization_id, session_id, member_id, status, recorded_by, check_in_method)
  values (target_org, p_session, m, 'present', auth.uid(), 'qr');
  return jsonb_build_object('status', 'checked_in');
end $$;

create or replace function public.set_pastoral_note(target_org uuid, p_member uuid, body text)
returns void language plpgsql security definer set search_path to '' as $$
begin
  if not private.has_permission(target_org, 'member.notes.manage') then
    raise exception 'Permission required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.members where id = p_member and organization_id = target_org) then
    raise exception 'Member not found';
  end if;
  insert into private.member_pastoral_notes(member_id, organization_id, body, updated_by, updated_at)
  values (p_member, target_org, body, auth.uid(), now())
  on conflict (member_id) do update
    set body = excluded.body, updated_by = auth.uid(), updated_at = now();
  insert into public.audit_logs(organization_id, user_id, action, resource_type, resource_id)
  values (target_org, auth.uid(), 'member.pastoral_note_updated', 'member', p_member);
end $$;

create or replace function public.get_pastoral_note(target_org uuid, p_member uuid)
returns text language plpgsql stable security definer set search_path to '' as $$
declare body text;
begin
  if not private.has_permission(target_org, 'member.notes.view') then
    raise exception 'Permission required' using errcode = '42501';
  end if;
  select n.body into body from private.member_pastoral_notes n
   where n.member_id = p_member and n.organization_id = target_org;
  return body;
end $$;

create or replace function public.archive_member(target_org uuid, p_member uuid, reason text default null)
returns void language plpgsql security definer set search_path to '' as $$
begin
  if not private.has_permission(target_org, 'member.archive') then
    raise exception 'Permission required' using errcode = '42501';
  end if;
  update public.members set status = 'archived', archived_at = now(), updated_at = now()
   where id = p_member and organization_id = target_org and archived_at is null;
  if not found then raise exception 'Member not found or already archived'; end if;
  insert into public.audit_logs(organization_id, user_id, action, resource_type, resource_id, details)
  values (target_org, auth.uid(), 'member.archived', 'member', p_member,
      jsonb_build_object('reason', reason));
end $$;

create or replace function public.convert_visitor(target_org uuid, p_visitor uuid,
    first_name text, last_name text) returns uuid
language plpgsql security definer set search_path to '' as $$
declare v public.visitors; result uuid;
begin
  if not private.has_permission(target_org, 'member.create')
     or not private.has_permission(target_org, 'visitor.manage') then
    raise exception 'Permission required' using errcode = '42501';
  end if;
  select * into v from public.visitors
   where id = p_visitor and organization_id = target_org for update;
  if v.id is null then raise exception 'Visitor not found'; end if;
  if v.converted_member_id is not null then return v.converted_member_id; end if;
  if length(trim(coalesce(first_name, ''))) < 1 or length(trim(coalesce(last_name, ''))) < 1 then
    raise exception 'First and last names are required';
  end if;
  insert into public.members(organization_id, branch_id, first_name, last_name, email, phone, joined_on,
      status, created_by)
  values (target_org, v.branch_id, trim(first_name), trim(last_name), v.email, v.phone, current_date,
      'active', auth.uid())
  returning id into result;
  update public.visitors
     set converted_member_id = result, converted_to_member = true, member_id = result,
         followup_status = 'converted'
   where id = p_visitor;
  insert into public.audit_logs(organization_id, user_id, action, resource_type, resource_id, details)
  values (target_org, auth.uid(), 'visitor.converted', 'visitor', p_visitor,
      jsonb_build_object('member_id', result));
  return result;
end $$;

create or replace function public.register_event(target_org uuid, p_event uuid, p_member uuid)
returns uuid language plpgsql security definer set search_path to '' as $$
declare e public.events; result uuid;
begin
  if not private.has_permission(target_org, 'event.manage') then
    raise exception 'Permission required' using errcode = '42501';
  end if;
  select * into e from public.events where id = p_event and organization_id = target_org for update;
  if e.id is null or e.status <> 'scheduled' or e.archived_at is not null then
    raise exception 'Event unavailable';
  end if;
  if not exists (select 1 from public.members
                  where id = p_member and organization_id = target_org and archived_at is null) then
    raise exception 'Member not found';
  end if;
  select id into result from public.event_registrations where event_id = p_event and member_id = p_member;
  if result is not null then return result; end if;
  if e.capacity is not null
     and (select count(*) from public.event_registrations where event_id = p_event) >= e.capacity then
    raise exception 'Event is full';
  end if;
  insert into public.event_registrations(organization_id, event_id, member_id)
  values (target_org, p_event, p_member) returning id into result;
  return result;
end $$;

create or replace function public.recurring_absentees(target_org uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare result jsonb; total integer;
begin
  if not private.has_permission(target_org, 'attendance.view') then
    raise exception 'Permission required' using errcode = '42501';
  end if;
  select count(*) into total from public.attendance_sessions
   where organization_id = target_org and session_date between p_from and p_to and archived_at is null;
  if total = 0 then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into result from (
    select m.id, m.first_name, m.last_name,
      (select count(*) from public.attendance_records ar
        where ar.member_id = m.id and ar.status = 'present'
          and ar.session_id in (select id from public.attendance_sessions
                                 where organization_id = target_org and session_date between p_from and p_to)) as attended
      from public.members m
     where m.organization_id = target_org and m.status = 'active' and m.archived_at is null
     order by m.first_name limit 200) t
  where t.attended = 0;
  return result;
end $$;

-- Platform administration: cross-tenant aggregates only, gated on the admins list.
create or replace function public.platform_overview() returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare result jsonb;
begin
  if not private.is_platform_admin() then
    raise exception 'Permission required' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'organizations_count', (select count(*) from public.organizations),
    'profiles_count', (select count(*) from public.profiles),
    'members_count', (select count(*) from public.members where archived_at is null),
    'active_subscriptions', (select count(*) from public.subscriptions
       where status in ('active','trialing') and ends_at > now()),
    'organizations', coalesce((select jsonb_agg(row_to_json(t)) from (
        select o.id, o.name, o.organization_type, o.country, o.timezone, o.status, o.contact_count,
               o.created_at, p.name as plan_name, p.slug as plan_slug, s.status as subscription_status,
               s.ends_at as subscription_ends_at,
               (select count(*) from public.organization_memberships m
                 where m.organization_id = o.id and m.status = 'active') as team_size
          from public.organizations o
          left join public.subscriptions s on s.organization_id = o.id
          left join public.plans p on p.id = s.plan
         order by o.created_at desc limit 100) t), '[]'::jsonb),
    'recent_activity', coalesce((select jsonb_agg(row_to_json(a)) from (
        select l.id, l.action, l.resource_type, l.created_at,
               (select name from public.organizations where id = l.organization_id) as organization_name
          from public.audit_logs l
         where l.action in ('workspace.created','staff.joined','staff.invited')
         order by l.created_at desc limit 20) a), '[]'::jsonb)
  ) into result;
  return result;
end $$;

revoke execute on function public.create_workspace(uuid, jsonb) from anon;
revoke execute on function public.platform_overview() from anon;
revoke execute on function public.am_i_platform_admin() from anon;
grant execute on function
  public.create_workspace(uuid, jsonb), public.accept_invitation(text), public.my_permissions(uuid),
  public.invite_staff(uuid, text, text, uuid[]), public.revoke_invitation(uuid, uuid),
  public.change_membership(uuid, uuid, text, text), public.workspace_summary(uuid, date, date),
  public.record_attendance(uuid, uuid, jsonb), public.start_qr_checkin(uuid, uuid, integer),
  public.qr_session_status(uuid, uuid, text), public.self_check_in(uuid, uuid, text),
  public.set_pastoral_note(uuid, uuid, text), public.get_pastoral_note(uuid, uuid),
  public.archive_member(uuid, uuid, text), public.convert_visitor(uuid, uuid, text, text),
  public.register_event(uuid, uuid, uuid), public.recurring_absentees(uuid, date, date),
  public.platform_overview(), public.am_i_platform_admin()
to authenticated;

-- ------------------------------------------------------------ 8. indexes
create index if not exists members_org_status_idx on public.members(organization_id, status);
create index if not exists members_org_branch_idx on public.members(organization_id, branch_id);
create index if not exists members_name_idx on public.members(organization_id, lower(last_name), lower(first_name));
create index if not exists memberships_user_idx on public.organization_memberships(user_id, status);
create index if not exists attendance_sessions_org_date_idx on public.attendance_sessions(organization_id, session_date desc);
create index if not exists attendance_records_member_idx on public.attendance_records(member_id);
create index if not exists contributions_org_date_idx on public.contributions(organization_id, given_at desc);
create index if not exists events_org_start_idx on public.events(organization_id, start_time);
create index if not exists audit_logs_org_created_idx on public.audit_logs(organization_id, created_at desc);
create index if not exists org_invitations_org_idx on public.organization_invitations(organization_id, created_at desc);
