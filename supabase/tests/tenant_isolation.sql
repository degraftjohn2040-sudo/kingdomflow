-- Tenant-isolation and RPC verification executed inside Postgres with simulated JWT claims.
-- Everything created here is removed at the end of the script.

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
  u1 uuid := gen_random_uuid();
  u2 uuid := gen_random_uuid();
  org1 uuid;
  org2 uuid;
  m1 uuid;
  sess uuid;
  br uuid;
  inv jsonb;
  n integer;
  nm integer;
  rv text;
  qr jsonb;
  blocked boolean := false;
  bad boolean := false;
  pinblocked boolean := false;
begin
  -- ---------------------------------------------------------------- fixtures
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  values
    (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'verify.owner@example.com', 'x', now(), now(), now(), '{"provider":"email"}', '{"full_name":"Verify Owner"}'),
    (u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'verify.viewer@example.com', 'x', now(), now(), now(), '{"provider":"email"}', '{"full_name":"Verify Viewer"}');
  insert into private.verify_ctx values ('u1', u1::text), ('u2', u2::text);

  -- ------------------------------------------------------- owner onboarding
  perform set_config('request.jwt.claims', json_build_object('sub', u1::text, 'role', 'authenticated')::text, false);
  perform set_config('role', 'authenticated', false);
  org1 := public.create_workspace(gen_random_uuid(), jsonb_build_object(
    'name', 'Verify Alpha Church', 'organization_type', 'church', 'country', 'GH', 'city', 'Cape Coast',
    'timezone', 'Africa/Accra', 'currency', 'GHS', 'denomination', 'Test', 'phone', '+233200000000',
    'email', 'office@example.com', 'full_name', 'Verify Owner', 'branch_name', 'Main Campus',
    'departments', jsonb_build_array('Choir', 'Ushering')));
  insert into private.verify_ctx values ('org1', org1::text);
  insert into private.verify_results values (1, 'create_workspace provisions an organization', org1 is not null, null);

  select id into br from public.branches where organization_id = org1 and is_main;
  n := (select count(*) from public.departments where organization_id = org1);
  insert into private.verify_results values (2, 'onboarding seeds main branch and departments', br is not null and n = 2, n || ' departments');
  rv := (select role || '/' || status from public.organization_memberships where organization_id = org1 and user_id = u1);
  insert into private.verify_results values (3, 'creator becomes active owner', rv = 'owner/active', rv);
  insert into private.verify_results values (4, 'free plan subscription assigned',
    (select count(*) from public.subscriptions s join public.plans p on p.id = s.plan where s.organization_id = org1 and p.slug = 'free') = 1, null);

  -- idempotency: replaying the same request key must not create a second workspace
  -- (guarded by the unique index on created_by + setup_request_key)

  -- ------------------------------------------------------------ owner writes
  insert into public.members (organization_id, branch_id, first_name, last_name, email, phone, status, created_by)
  values (org1, br, 'Ama', 'Mensah', 'ama@example.com', '+233240000001', 'active', u1)
  returning id into m1;
  insert into private.verify_results values (5, 'owner can create a member', m1 is not null, null);

  insert into public.attendance_sessions (organization_id, title, session_date, branch_id, created_by)
  values (org1, 'Verify Service', current_date, br, u1) returning id into sess;
  n := public.record_attendance(org1, sess, jsonb_build_array(jsonb_build_object('member_id', m1, 'status', 'present', 'client_ref', 'v1')));
  n := public.record_attendance(org1, sess, jsonb_build_array(jsonb_build_object('member_id', m1, 'status', 'present', 'client_ref', 'v1')));
  insert into private.verify_results values (6, 'attendance replay is idempotent',
    (select count(*) from public.attendance_records where session_id = sess) = 1,
    (select count(*)::text from public.attendance_records where session_id = sess) || ' row(s)');

  insert into public.contributions (organization_id, branch_id, amount, currency, category, payment_method, given_at, recorded_by)
  values (org1, br, 250, 'GHS', 'offering', 'cash', current_date, u1);
  insert into private.verify_results values (7, 'owner can record a contribution', true, null);

  insert into public.members (organization_id, first_name, last_name, status, created_by)
  values (org1, 'Kojo', 'Owusu', 'active', u1);

  -- QR flow
  begin
    qr := public.start_qr_checkin(org1, sess, 60);
    insert into private.verify_results values (8, 'QR secret minted', qr ? 'secret', null);
    begin
      perform public.qr_session_status(org1, sess, repeat('0', 64));
    exception when others then bad := true;
    end;
    insert into private.verify_results values (9, 'wrong QR secret rejected', bad, null);
    insert into private.verify_results values (10, 'valid QR secret accepted',
      (public.qr_session_status(org1, sess, qr->>'secret') ->> 'session_id') = sess::text, null);
    insert into private.verify_ctx values ('qrsecret', qr->>'secret'), ('sess', sess::text);
  end;

  -- ------------------------------------------------------- second workspace
  perform set_config('request.jwt.claims', json_build_object('sub', u2::text, 'role', 'authenticated')::text, false);
  org2 := public.create_workspace(gen_random_uuid(), jsonb_build_object(
    'name', 'Verify Beta Church', 'organization_type', 'fellowship', 'country', 'GH', 'city', 'Accra',
    'timezone', 'Africa/Accra', 'currency', 'GHS', 'full_name', 'Verify Viewer', 'departments', jsonb_build_array('Youth')));
  insert into private.verify_ctx values ('org2', org2::text);
  insert into private.verify_results values (11, 'second tenant created', org2 is not null and org2 <> org1, null);

  -- --------------------------------------------------- cross-tenant attacks
  nm := (select count(*) from public.members where organization_id = org1);
  insert into private.verify_results values (12, 'cross-tenant member read returns nothing', nm = 0, nm || ' row(s)');
  insert into private.verify_results values (13, 'cross-tenant organization read returns nothing',
    (select count(*) from public.organizations where id = org1) = 0, null);
  insert into private.verify_results values (14, 'cross-tenant attendance read returns nothing',
    (select count(*) from public.attendance_sessions where organization_id = org1) = 0, null);
  insert into private.verify_results values (15, 'cross-tenant finance read returns nothing',
    (select count(*) from public.contributions where organization_id = org1) = 0, null);
  begin
    perform count(*) from private.member_pastoral_notes where organization_id = org1;
  exception when others then pinblocked := true;
  end;
  insert into private.verify_results values (16, 'cross-tenant pastoral note blocked', pinblocked, null);

  begin
    insert into public.members (organization_id, first_name, last_name, status, created_by)
    values (org1, 'Intruder', 'Attempt', 'active', u2);
  exception when others then blocked := true;
  end;
  insert into private.verify_results values (17, 'cross-tenant member insert blocked', blocked, null);

  blocked := false;
  begin
    insert into public.organization_memberships (organization_id, user_id, role, status)
    values (org1, u2, 'owner', 'active');
  exception when others then blocked := true;
  end;
  insert into private.verify_results values (18, 'self-join into another organization blocked', blocked, null);

  blocked := false;
  begin
    insert into public.organizations (name, slug) values ('Rogue Org', 'rogue-org-' || floor(random() * 100000));
  exception when others then blocked := true;
  end;
  insert into private.verify_results values (19, 'direct organization insert blocked (RPC only)', blocked, null);

  blocked := false;
  begin
    perform public.qr_session_status(org1, sess, (select v from private.verify_ctx where k = 'qrsecret'));
  exception when others then blocked := true;
  end;
  insert into private.verify_results values (20, 'cross-tenant QR validation blocked', blocked, null);

  -- u2 is the sole owner of org2: demoting themselves would orphan the workspace.
  blocked := false;
  begin
    update public.organization_memberships set role = 'admin' where organization_id = org2 and user_id = u2;
  exception when others then blocked := true;
  end;
  insert into private.verify_results values (21, 'sole owner cannot demote themselves', blocked,
    (select role from public.organization_memberships where organization_id = org2 and user_id = u2));

  blocked := false;
  begin
    update public.profiles set is_platform_admin = true where id = u2;
  exception when others then blocked := true;
  end;
  insert into private.verify_results values (22, 'platform-admin self-escalation blocked', blocked, null);

  -- ------------------------------------------------------------ invitations
  perform set_config('request.jwt.claims', json_build_object('sub', u1::text, 'role', 'authenticated')::text, false);
  inv := public.invite_staff(org1, 'verify.viewer@example.com', 'viewer', array[]::uuid[]);
  insert into private.verify_results values (23, 'owner can invite staff', (inv->>'token') is not null, null);
  insert into private.verify_ctx values ('token', inv->>'token');

  perform set_config('request.jwt.claims', json_build_object('sub', u2::text, 'role', 'authenticated')::text, false);
  perform public.accept_invitation((select v from private.verify_ctx where k = 'token'));
  insert into private.verify_results values (24, 'invitation accepted into the organization',
    (select role from public.organization_memberships where organization_id = org1 and user_id = u2) = 'viewer', null);

  insert into private.verify_results values (25, 'viewer can read members after joining',
    (select count(*) from public.members where organization_id = org1) = 2, null);
  insert into private.verify_results values (26, 'viewer cannot read giving records',
    (select count(*) from public.contributions where organization_id = org1) = 0, null);
  insert into private.verify_results values (27, 'viewer cannot read the audit log',
    (select count(*) from public.audit_logs where organization_id = org1) = 0, null);

  blocked := false;
  begin
    perform public.invite_staff(org1, 'someone@example.com', 'viewer', array[]::uuid[]);
  exception when others then blocked := true;
  end;
  insert into private.verify_results values (28, 'viewer cannot invite staff', blocked, null);

  update public.members set first_name = 'Hacked' where id = m1;
  insert into private.verify_results values (29, 'viewer cannot update members',
    (select first_name from public.members where id = m1) = 'Ama', null);

  -- ---------------------------------------------------------------- cleanup
  perform set_config('role', 'postgres', false);
  delete from public.attendance_records where organization_id in (org1, org2);
  delete from public.attendance_sessions where organization_id in (org1, org2);
  delete from public.contributions where organization_id in (org1, org2);
  delete from public.organization_invitations where organization_id in (org1, org2);
  delete from public.department_members where department_id in (select id from public.departments where organization_id in (org1, org2));
  delete from public.departments where organization_id in (org1, org2);
  delete from public.members where organization_id in (org1, org2);
  delete from public.branches where organization_id in (org1, org2);
  delete from public.audit_logs where organization_id in (org1, org2);
  delete from public.subscriptions where organization_id in (org1, org2);
  delete from public.organization_memberships where organization_id in (org1, org2);
  delete from public.organizations where id in (org1, org2);
  delete from public.profiles where id in (u1, u2);
  delete from auth.users where id in (u1, u2);
  insert into private.verify_results values (30, 'fixtures cleaned up',
    (select count(*) from public.organizations where id in (org1, org2)) = 0, null);
end $$;

select step, name, case when passed then 'PASS' else 'FAIL' end as result, detail
from private.verify_results order by step;
