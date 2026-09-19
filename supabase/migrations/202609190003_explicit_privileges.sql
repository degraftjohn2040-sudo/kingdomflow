begin;
-- Supabase projects may grant ALL to anon/authenticated through default privileges.
-- GRANT SELECT alone does not remove those defaults. Reset every application table
-- explicitly before granting the minimum needed by this release.
revoke all on public.plans,public.profiles,public.organizations,public.organization_members,
 public.departments,public.groups,public.members,public.events,public.visitors,
 public.attendance_sessions,public.attendance_records,public.followups,public.prayer_requests,
 public.volunteers,public.contributions,public.audit_logs,public.payments,public.ai_usage
 from public,anon,authenticated;
-- Table-level revoke does not revoke earlier column-level privileges.
revoke update(name,organization_type,email,phone,country,timezone,denomination) on public.organizations from public,anon,authenticated;
grant select on public.plans,public.profiles,public.organizations,public.organization_members,
 public.departments,public.groups,public.members,public.events,public.visitors,
 public.attendance_sessions,public.attendance_records,public.followups,public.prayer_requests,
 public.volunteers,public.contributions,public.audit_logs,public.payments,public.ai_usage to authenticated;
grant insert,update on public.profiles,public.departments,public.groups,public.members,
 public.events,public.attendance_sessions,public.attendance_records,public.followups,
 public.prayer_requests,public.volunteers,public.contributions to authenticated;
grant update(name,organization_type,email,phone,country,timezone,denomination) on public.organizations to authenticated;
grant insert(organization_id,first_name,last_name,phone,email,first_visit_date,invited_by,event_id,status,assigned_worker,next_action,next_follow_up,notes),
 update(first_name,last_name,phone,email,first_visit_date,invited_by,event_id,status,assigned_worker,next_action,next_follow_up,notes)
 on public.visitors to authenticated;
-- Conversion alone writes converted_member_id. It already checks the current user's
-- membership, both permissions, entitlement, and explicit tenant, under a row lock.
alter function public.convert_visitor(uuid,uuid) security definer;

revoke all on function public.authorize(uuid,text),public.entitled(uuid,text),
 public.create_organization(text,text,text,text,text,text,text),public.convert_visitor(uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.authorize(uuid,text),public.entitled(uuid,text),
 public.create_organization(text,text,text,text,text,text,text),public.convert_visitor(uuid,uuid) to authenticated;
revoke all on function private.has_permission(uuid,text),private.is_member(uuid),private.has_feature(uuid,text),
 private.audit_change(),private.guard_update(),private.guard_member_status(),private.guard_attendance_author(),
 private.can_access_file(text,text) from public,anon,authenticated;
grant execute on function private.has_permission(uuid,text),private.is_member(uuid),private.has_feature(uuid,text),
 private.can_access_file(text,text) to authenticated;

create function private.guard_organization() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from pg_timezone_names where name=new.timezone) then
 raise exception 'Invalid timezone' using errcode='23514'; end if;
 new.updated_at=now(); return new;
end $$;
revoke all on function private.guard_organization() from public,anon,authenticated;
create trigger organization_updated before update on public.organizations for each row execute function private.guard_organization();
commit;
