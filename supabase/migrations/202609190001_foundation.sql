-- KingdomFlow foundation. Apply through Supabase migrations, never from a browser.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.plans (
  id text primary key check (id in ('trial','pro','premium_ai')),
  name text not null, price_minor integer not null check(price_minor >= 0),
  currency text not null default 'GHS' check(currency = 'GHS'),
  duration_months integer, trial_days integer,
  features text[] not null
);
insert into public.plans values
 ('trial','Free Trial',0,'GHS',null,30,array['core']),
 ('pro','Pro',15000,'GHS',1,null,array['core','reports','communications','finance']),
 ('premium_ai','Premium AI',50000,'GHS',3,null,array['core','reports','communications','finance','ai']);
alter table public.plans enable row level security;
create policy plans_read on public.plans for select to authenticated using (true);
grant select on public.plans to authenticated;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null check(length(full_name) between 1 and 150),
 phone text check(length(phone) <= 40), updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy profile_self_read on public.profiles for select to authenticated using (id=auth.uid());
create policy profile_self_insert on public.profiles for insert to authenticated with check (id=auth.uid());
create policy profile_self_update on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());
grant select, insert, update on public.profiles to authenticated;

create table public.organizations (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 2 and 150),
 slug text not null unique,
 organization_type text not null default 'church' check (organization_type in ('church','ministry','fellowship','campus','network','other')),
 logo_url text, email text check(length(email)<=254), phone text check(length(phone)<=40),
 country text not null default 'Ghana' check(length(country) between 2 and 100),
 timezone text not null default 'Africa/Accra', denomination text check(length(denomination)<=150),
 subscription_plan text not null default 'trial' references public.plans(id),
 subscription_status text not null default 'trialing' check(subscription_status in ('trialing','active','expired','cancelled')),
 trial_ends_at timestamptz not null default (now()+interval '30 days'),
 subscription_ends_at timestamptz,
 onboarding_completed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.organization_members (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('owner','admin','pastor','secretary','finance','department_leader','group_leader','follow_up_leader','volunteer_coordinator','member')),
 status text not null default 'active' check(status in ('active','suspended')),
 created_at timestamptz not null default now(),
 unique(organization_id,user_id)
);
create index organization_members_user on public.organization_members(user_id, status);

create function private.has_permission(org uuid, permission text) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.organization_members m
 where m.organization_id=org and m.user_id=auth.uid() and m.status='active' and (
 (m.role in ('owner','admin') and permission = any(array['members.read','members.create','members.update','members.delete','visitors.read','visitors.manage','attendance.read','attendance.manage','departments.read','departments.manage','groups.read','groups.manage','events.read','events.manage','followups.read','followups.manage','prayer.read','prayer.manage','prayer.confidential','volunteers.read','volunteers.manage','finance.read','finance.manage','reports.view','communications.send','organization.settings','users.manage','subscription.manage','ai.use','audit.read'])) or
 (m.role='pastor' and permission = any(array['members.read','visitors.read','visitors.manage','attendance.read','departments.read','groups.read','events.read','events.manage','followups.read','followups.manage','prayer.read','prayer.manage','prayer.confidential','volunteers.read','reports.view','communications.send','ai.use'])) or
 (m.role='secretary' and permission = any(array['members.read','members.create','members.update','visitors.read','visitors.manage','attendance.read','attendance.manage','departments.read','departments.manage','groups.read','groups.manage','events.read','events.manage','followups.read','followups.manage','prayer.read','volunteers.read','reports.view','communications.send'])) or
 (m.role='finance' and permission = any(array['members.read','finance.read','finance.manage','reports.view'])) or
 (m.role='department_leader' and permission = any(array['members.read','departments.read','attendance.read','attendance.manage','events.read'])) or
 (m.role='group_leader' and permission = any(array['members.read','groups.read','attendance.read','attendance.manage','events.read'])) or
 (m.role='follow_up_leader' and permission = any(array['members.read','visitors.read','visitors.manage','followups.read','followups.manage'])) or
 (m.role='volunteer_coordinator' and permission = any(array['members.read','volunteers.read','volunteers.manage','events.read']))
 ))
$$;
create function private.is_member(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.organization_members where organization_id=org and user_id=auth.uid() and status='active')
$$;
create function private.has_feature(org uuid, feature text) returns boolean
language sql stable security definer set search_path = '' as $$
 select private.is_member(org) and exists(select 1 from public.organizations o join public.plans p on p.id=o.subscription_plan
 where o.id=org and feature=any(p.features) and
 ((o.subscription_status='trialing' and o.subscription_plan='trial' and o.trial_ends_at>now()) or
 (o.subscription_status='active' and o.subscription_ends_at>now())))
$$;
revoke all on function private.has_permission(uuid,text), private.is_member(uuid), private.has_feature(uuid,text) from public;
grant execute on function private.has_permission(uuid,text), private.is_member(uuid), private.has_feature(uuid,text) to authenticated;

-- Public wrapper permits server actions to check the identical database permission map.
create function public.authorize(organization uuid, permission text) returns boolean
language sql stable security invoker set search_path = '' as $$ select private.has_permission(organization,permission) $$;
create function public.entitled(organization uuid, feature text) returns boolean
language sql stable security invoker set search_path = '' as $$ select private.has_feature(organization,feature) $$;
revoke all on function public.authorize(uuid,text), public.entitled(uuid,text) from public;
grant execute on function public.authorize(uuid,text), public.entitled(uuid,text) to authenticated;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
create policy org_read on public.organizations for select to authenticated using (private.is_member(id));
create policy org_update on public.organizations for update to authenticated using(private.has_permission(id,'organization.settings')) with check(private.has_permission(id,'organization.settings'));
create policy membership_read on public.organization_members for select to authenticated using(private.is_member(organization_id) and (user_id=auth.uid() or private.has_permission(organization_id,'users.manage')));
grant select on public.organizations, public.organization_members to authenticated;
-- Subscription, identity, tenant, role and status columns are NEVER writable by ordinary users.
grant update(name,organization_type,email,phone,country,timezone,denomination) on public.organizations to authenticated;

create table public.departments (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 name text not null check(length(trim(name)) between 2 and 150), description text check(length(description)<=4000),
 leader_name text check(length(leader_name)<=150), status text not null default 'active' check(status in ('active','archived')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,organization_id), unique(organization_id,name)
);
create table public.groups (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 name text not null check(length(trim(name)) between 2 and 150), group_type text not null default 'small_group' check(group_type in ('cell','small_group','bible_study','campus','fellowship','discipleship')),
 leader_name text check(length(leader_name)<=150), meeting_schedule text check(length(meeting_schedule)<=500), notes text check(length(notes)<=4000),
 status text not null default 'active' check(status in ('active','archived')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,organization_id), unique(organization_id,name)
);
create table public.members (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 first_name text not null check(length(trim(first_name)) between 1 and 100), last_name text not null check(length(trim(last_name)) between 1 and 100),
 gender text check(gender in ('female','male','not_specified')),
 date_of_birth date check(date_of_birth >= '1900-01-01'),
 phone text check(length(phone)<=40), email text check(length(email)<=254), address text check(length(address)<=1000),
 occupation text check(length(occupation)<=150), marital_status text check(marital_status in ('single','married','widowed','divorced','not_specified')),
 status text not null default 'active' check(status in ('active','inactive','archived')),
 membership_date date not null default current_date,
 department_id uuid, group_id uuid,
 emergency_contact text check(length(emergency_contact)<=500), notes text check(length(notes)<=4000),
 avatar_path text check(length(avatar_path)<=500),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,organization_id),
 foreign key(department_id,organization_id) references public.departments(id,organization_id),
 foreign key(group_id,organization_id) references public.groups(id,organization_id)
);
create index members_org_name on public.members(organization_id,last_name,first_name);
create index members_org_email on public.members(organization_id,email);
create index members_org_phone on public.members(organization_id,phone);
create index members_org_status on public.members(organization_id,status);
create index members_org_created on public.members(organization_id,created_at);

create table public.events (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 title text not null check(length(trim(title)) between 2 and 150), description text check(length(description)<=4000),
 venue text check(length(venue)<=300), starts_at timestamptz not null, ends_at timestamptz not null,
 organizer text check(length(organizer)<=150), capacity integer check(capacity>0),
 status text not null default 'scheduled' check(status in ('scheduled','completed','cancelled')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,organization_id), check(ends_at>=starts_at)
);
create index events_org_start on public.events(organization_id,starts_at);
create table public.visitors (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 first_name text not null check(length(trim(first_name)) between 1 and 100), last_name text not null check(length(trim(last_name)) between 1 and 100),
 phone text check(length(phone)<=40), email text check(length(email)<=254), first_visit_date date not null default current_date,
 invited_by uuid, event_id uuid,
 status text not null default 'new' check(status in ('new','contacted','scheduled','joined','closed')),
 assigned_worker text check(length(assigned_worker)<=150), next_action text check(length(next_action)<=1000), next_follow_up date,
 notes text check(length(notes)<=4000), converted_member_id uuid,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,organization_id),
 foreign key(invited_by,organization_id) references public.members(id,organization_id),
 foreign key(event_id,organization_id) references public.events(id,organization_id),
 foreign key(converted_member_id,organization_id) references public.members(id,organization_id)
);
create index visitors_org_followup on public.visitors(organization_id,next_follow_up);
create table public.attendance_sessions (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 title text not null check(length(trim(title)) between 2 and 150), session_date date not null,
 session_type text not null check(session_type in ('service','meeting','event','group','department')),
 event_id uuid, group_id uuid, department_id uuid,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,organization_id),
 foreign key(event_id,organization_id) references public.events(id,organization_id),
 foreign key(group_id,organization_id) references public.groups(id,organization_id),
 foreign key(department_id,organization_id) references public.departments(id,organization_id),
 check((session_type='event' and event_id is not null and group_id is null and department_id is null) or
 (session_type='group' and group_id is not null and event_id is null and department_id is null) or
 (session_type='department' and department_id is not null and event_id is null and group_id is null) or
 (session_type in ('service','meeting') and event_id is null and group_id is null and department_id is null))
);
create index sessions_org_date on public.attendance_sessions(organization_id,session_date);
create table public.attendance_records (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 session_id uuid not null, member_id uuid not null, status text not null check(status in ('present','absent')),
 recorded_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization_id,session_id,member_id),
 foreign key(session_id,organization_id) references public.attendance_sessions(id,organization_id),
 foreign key(member_id,organization_id) references public.members(id,organization_id)
);
create table public.followups (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 title text not null check(length(trim(title)) between 2 and 150), visitor_id uuid, member_id uuid,
 assigned_worker text check(length(assigned_worker)<=150), next_follow_up date not null,
 status text not null default 'new' check(status in ('new','contacted','required','scheduled','visited','joined_group','joined_church','needs_attention','closed')),
 contact_attempts integer not null default 0 check(contact_attempts between 0 and 10000), notes text check(length(notes)<=4000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(visitor_id,organization_id) references public.visitors(id,organization_id),
 foreign key(member_id,organization_id) references public.members(id,organization_id)
);
create index followups_org_date on public.followups(organization_id,next_follow_up);
create table public.prayer_requests (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 title text not null check(length(trim(title)) between 2 and 150), requester text check(length(requester)<=150),
 category text not null default 'general' check(category in ('general','health','family','work','thanksgiving')),
 details text not null check(length(details) between 1 and 4000),
 confidentiality text not null default 'leadership' check(confidentiality in ('team','leadership')),
 assigned_team text check(length(assigned_team)<=150),
 status text not null default 'open' check(status in ('open','praying','answered','closed')), testimony text check(length(testimony)<=4000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.volunteers (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 member_id uuid not null, skills text check(length(skills)<=1000), availability text check(length(availability)<=1000),
 assignment text check(length(assignment)<=1000), service_schedule text check(length(service_schedule)<=1000),
 status text not null default 'active' check(status in ('active','unavailable','archived')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,member_id),
 foreign key(member_id,organization_id) references public.members(id,organization_id)
);
create table public.contributions (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 member_id uuid, amount numeric(12,2) not null check(amount>0), currency text not null default 'GHS' check(currency='GHS'),
 contribution_type text not null check(contribution_type in ('tithe','offering','donation','pledge','fundraising','special')),
 payment_method text not null check(payment_method in ('cash','mobile_money','bank','card','other')),
 reference text check(length(reference)<=150), contribution_date date not null,
 notes text check(length(notes)<=4000), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(member_id,organization_id) references public.members(id,organization_id)
);
create index contributions_org_date on public.contributions(organization_id,contribution_date);

create table public.audit_logs (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid references auth.users(id) on delete set null,
 action text not null, resource_type text not null, resource_id uuid,
 metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index audit_org_created on public.audit_logs(organization_id,created_at desc);
alter table public.audit_logs enable row level security;
create policy audit_read on public.audit_logs for select to authenticated using(private.has_permission(organization_id,'audit.read'));
grant select on public.audit_logs to authenticated;

create function private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare rowdata jsonb; org uuid;
begin
 rowdata := case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 org := case when TG_TABLE_NAME='organizations' then (rowdata->>'id')::uuid else (rowdata->>'organization_id')::uuid end;
 insert into public.audit_logs(organization_id,user_id,action,resource_type,resource_id,metadata)
 values(org,auth.uid(),lower(TG_OP),TG_TABLE_NAME,(rowdata->>'id')::uuid,'{}'::jsonb);
 return case when TG_OP='DELETE' then old else new end;
end $$;
create function private.guard_update() returns trigger language plpgsql set search_path='' as $$
begin
 if new.id<>old.id or new.organization_id<>old.organization_id or new.created_at<>old.created_at then
 raise exception 'Identity and tenant are immutable' using errcode='42501'; end if;
 new.updated_at=now(); return new;
end $$;
revoke all on function private.audit_change(), private.guard_update() from public;

-- Grant only the operations supported by the product. Core deletes use archive/status.
do $$
declare t text; readperm text; writeperm text; extra text;
begin
 for t,readperm,writeperm in select * from (values
 ('members','members.read','members.update'),('visitors','visitors.read','visitors.manage'),
 ('departments','departments.read','departments.manage'),('groups','groups.read','groups.manage'),
 ('events','events.read','events.manage'),('attendance_sessions','attendance.read','attendance.manage'),
 ('attendance_records','attendance.read','attendance.manage'),('followups','followups.read','followups.manage'),
 ('prayer_requests','prayer.read','prayer.manage'),('volunteers','volunteers.read','volunteers.manage'),
 ('contributions','finance.read','finance.manage')) as x(t,r,w)
 loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create index %I on public.%I(organization_id,created_at desc)',t||'_org_created_idx',t);
 extra := case when t='prayer_requests' then ' and (confidentiality=''team'' or private.has_permission(organization_id,''prayer.confidential''))' when t='contributions' then ' and private.has_feature(organization_id,''finance'')' else '' end;
 execute format('create policy tenant_read on public.%I for select to authenticated using(private.has_permission(organization_id,%L)%s)',t,readperm,extra);
 execute format('create policy tenant_insert on public.%I for insert to authenticated with check(private.has_permission(organization_id,%L) and private.has_feature(organization_id,''core'')%s)',t,case when t='members' then 'members.create' else writeperm end,extra);
 execute format('create policy tenant_update on public.%I for update to authenticated using(private.has_permission(organization_id,%L) and private.has_feature(organization_id,''core'')%s) with check(private.has_permission(organization_id,%L) and private.has_feature(organization_id,''core'')%s)',t,writeperm,extra,writeperm,extra);
 execute format('grant select,insert,update on public.%I to authenticated',t);
 execute format('create trigger guard_update before update on public.%I for each row execute function private.guard_update()',t);
 execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function private.audit_change()',t);
 end loop;
end $$;
create trigger audit_org after update on public.organizations for each row execute function private.audit_change();
create trigger audit_membership after insert or update or delete on public.organization_members for each row execute function private.audit_change();

-- Stronger permissions for archiving and protection of system-written fields.
create function private.guard_member_status() returns trigger language plpgsql set search_path='' as $$
begin
 if new.status='archived' and (TG_OP='INSERT' or old.status<>'archived') and not private.has_permission(new.organization_id,'members.delete') then
 raise exception 'Permission required: members.delete' using errcode='42501'; end if;
 return new;
end $$;
create trigger member_archive before insert or update on public.members for each row execute function private.guard_member_status();
create function private.guard_attendance_author() returns trigger language plpgsql set search_path='' as $$
begin new.recorded_by=auth.uid(); return new; end $$;
create trigger attendance_author before insert or update on public.attendance_records for each row execute function private.guard_attendance_author();
revoke all on function private.guard_member_status(),private.guard_attendance_author() from public;

create function public.create_organization(org_name text, org_type text, org_country text, org_timezone text, contact_email text, contact_phone text, administrator_name text)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Email verification required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 if exists(select 1 from public.organization_members where user_id=auth.uid()) then raise exception 'A workspace membership already exists'; end if;
 if not exists(select 1 from pg_timezone_names where name=org_timezone) then raise exception 'Invalid timezone'; end if;
 insert into public.organizations(name,slug,organization_type,country,timezone,email,phone,onboarding_completed_at)
 values(trim(org_name),gen_random_uuid()::text,org_type,org_country,org_timezone,contact_email,contact_phone,now()) returning id into result;
 insert into public.organization_members(organization_id,user_id,role) values(result,auth.uid(),'owner');
 insert into public.profiles(id,full_name,phone) values(auth.uid(),administrator_name,contact_phone)
 on conflict(id) do update set full_name=excluded.full_name, phone=excluded.phone, updated_at=now();
 return result;
end $$;
revoke all on function public.create_organization(text,text,text,text,text,text,text) from public;
grant execute on function public.create_organization(text,text,text,text,text,text,text) to authenticated;

-- Row locking makes repeated conversions idempotent; transaction prevents partial conversion.
create function public.convert_visitor(visitor uuid, organization uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v public.visitors; result uuid;
begin
 if not private.has_permission(organization,'visitors.manage') or not private.has_permission(organization,'members.create') or not private.has_feature(organization,'core') then
 raise exception 'Permission or active subscription required' using errcode='42501'; end if;
 select * into v from public.visitors where id=visitor and organization_id=organization for update;
 if not found then raise exception 'Visitor not found' using errcode='P0002'; end if;
 if v.converted_member_id is not null then return v.converted_member_id; end if;
 insert into public.members(organization_id,first_name,last_name,phone,email,notes)
 values(organization,v.first_name,v.last_name,v.phone,v.email,v.notes) returning id into result;
 update public.visitors set converted_member_id=result,status='joined' where id=visitor and organization_id=organization;
 return result;
end $$;
revoke all on function public.convert_visitor(uuid,uuid) from public;
grant execute on function public.convert_visitor(uuid,uuid) to authenticated;
commit;
