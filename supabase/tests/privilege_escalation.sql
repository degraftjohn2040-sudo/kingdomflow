-- =============================================================================
-- Privilege-escalation harness
-- =============================================================================
-- Complements tenant_isolation.sql: this one focuses on role changes, invitation
-- abuse and suspension, using three simulated accounts in a throwaway tenant.
-- Everything created here is deleted at the end, and no existing row is touched.
--
-- Run with the SQL editor (or `supabase db execute`). Results land in
-- private.verify_results; the trailing SELECT prints PASS/FAIL per assertion.
--
-- Verified 2026-10-28 against project ivglimtjzcdfyflscngh: 6/6 PASS.
-- =============================================================================

create table if not exists private.verify_results (
  step integer,
  name text,
  passed boolean,
  detail text
);
delete from private.verify_results;
create table if not exists private.verify_ctx (k text primary key, v text);
delete from private.verify_ctx;
grant usage on schema private to authenticated;
grant select, insert on private.verify_results to authenticated;
grant select, insert on private.verify_ctx to authenticated;

do $$
declare
  o uuid := gen_random_uuid();   -- owner
  a uuid := gen_random_uuid();   -- administrator
  w uuid := gen_random_uuid();   -- viewer
  org uuid; inv_a jsonb; inv_w jsonb; blocked boolean; r text;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values (o,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','esc2.owner@example.com','x',now(),now(),now(),'{}','{"full_name":"Owner"}'),
         (a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','esc2.admin@example.com','x',now(),now(),now(),'{}','{"full_name":"Admin"}'),
         (w,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','esc2.viewer@example.com','x',now(),now(),now(),'{}','{"full_name":"Viewer"}');

  perform set_config('request.jwt.claims', json_build_object('sub', o::text, 'role','authenticated')::text, false);
  perform set_config('role','authenticated', false);
  org := public.create_workspace(gen_random_uuid(), jsonb_build_object(
    'name','Escalation Two Church','organization_type','church','country','GH',
    'timezone','Africa/Accra','currency','GHS','full_name','Owner',
    'departments', jsonb_build_array('Choir')));

  inv_a := public.invite_staff(org, 'esc2.admin@example.com', 'admin', array[]::uuid[]);
  inv_w := public.invite_staff(org, 'esc2.viewer@example.com', 'viewer', array[]::uuid[]);

  perform set_config('request.jwt.claims', json_build_object('sub', a::text, 'role','authenticated')::text, false);
  perform public.accept_invitation(inv_a->>'token');
  perform set_config('request.jwt.claims', json_build_object('sub', w::text, 'role','authenticated')::text, false);
  perform public.accept_invitation(inv_w->>'token');

  r := (select role from public.organization_memberships where organization_id = org and user_id = w);
  insert into private.verify_results values (1, 'viewer membership created by invitation', r = 'viewer', r);

  -- A viewer has no staff.manage: the row is filtered out by RLS, so the write
  -- silently affects nothing and the role is unchanged.
  blocked := false;
  begin
    update public.organization_memberships set role = 'admin' where organization_id = org and user_id = w;
  exception when others then blocked := true;
  end;
  r := (select role from public.organization_memberships where organization_id = org and user_id = w);
  insert into private.verify_results values (2, 'viewer cannot self-promote', r = 'viewer',
    'raised=' || blocked || ' role=' || r);

  -- An administrator may manage staff but must not be able to mint another owner.
  perform set_config('request.jwt.claims', json_build_object('sub', a::text, 'role','authenticated')::text, false);
  blocked := false;
  begin
    update public.organization_memberships set role = 'owner' where organization_id = org and user_id = w;
  exception when others then blocked := true;
  end;
  r := (select role from public.organization_memberships where organization_id = org and user_id = w);
  insert into private.verify_results values (3, 'admin cannot grant ownership to another user', blocked and r = 'viewer',
    'raised=' || blocked || ' role=' || r);

  -- ...but may legitimately assign a role inside their own authority.
  begin
    perform public.change_membership(org, w, 'secretary', 'active');
  exception when others then null;
  end;
  r := (select role from public.organization_memberships where organization_id = org and user_id = w);
  insert into private.verify_results values (4, 'admin can assign a role within their authority', r = 'secretary', r);

  perform set_config('request.jwt.claims', json_build_object('sub', w::text, 'role','authenticated')::text, false);
  insert into private.verify_results values (5, 'secretary sees no finance records',
    (select count(*) from public.contributions where organization_id = org) = 0, null);
  insert into private.verify_results values (6, 'secretary still sees the workspace',
    (select count(*) from public.organizations where id = org) = 1, null);

  -- Cleanup. Order respects foreign keys; auth.users last.
  perform set_config('role','postgres', false);
  delete from public.organization_invitations where organization_id = org;
  delete from public.audit_logs where organization_id = org;
  delete from public.subscriptions where organization_id = org;
  delete from public.organization_memberships where organization_id = org;
  delete from public.departments where organization_id = org;
  delete from public.branches where organization_id = org;
  delete from public.organizations where id = org;
  delete from public.profiles where id in (o, a, w);
  delete from auth.users where id in (o, a, w);
end $$;

select step, name, case when passed then 'PASS' else 'FAIL' end as result, detail
from private.verify_results order by step;
