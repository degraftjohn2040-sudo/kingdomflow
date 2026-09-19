begin;
-- Provider-owned records: authenticated users may read authorized rows but cannot
-- create payments, mark anything verified, change plans, or approve manual payments.
create table public.payments (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 amount_minor integer not null check(amount_minor>0), currency text not null default 'GHS' check(currency='GHS'),
 provider text not null check(provider in ('paystack','manual_momo')),
 provider_reference text not null unique check(length(provider_reference) between 1 and 200),
 status text not null default 'pending' check(status in ('pending','verified','failed','rejected')),
 plan text not null references public.plans(id) check(plan<>'trial'),
 created_at timestamptz not null default now(), verified_at timestamptz,
 check((status='verified' and verified_at is not null) or (status<>'verified' and verified_at is null))
);
create index payments_org_created on public.payments(organization_id,created_at desc);
alter table public.payments enable row level security;
create policy payment_read on public.payments for select to authenticated using(private.has_permission(organization_id,'subscription.manage'));
grant select on public.payments to authenticated;
create trigger audit_payment after insert or update on public.payments for each row execute function private.audit_change();

create table public.ai_usage (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 user_id uuid not null references auth.users(id), feature text not null, model text not null,
 input_tokens integer not null check(input_tokens>=0), output_tokens integer not null check(output_tokens>=0),
 created_at timestamptz not null default now()
);
create index ai_usage_org_created on public.ai_usage(organization_id,created_at desc);
alter table public.ai_usage enable row level security;
create policy ai_usage_read on public.ai_usage for select to authenticated using(private.has_permission(organization_id,'ai.use') and private.has_feature(organization_id,'ai'));
grant select on public.ai_usage to authenticated;

-- Private files. Upload UI is deliberately not enabled until live storage is validated.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('organization-files','organization-files',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do nothing;
create function private.can_access_file(path text, permission text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organization_members m where m.organization_id::text=split_part(path,'/',1)
 and m.user_id=auth.uid() and m.status='active' and private.has_permission(m.organization_id,permission))
$$;
revoke all on function private.can_access_file(text,text) from public;
grant execute on function private.can_access_file(text,text) to authenticated;
create policy org_files_read on storage.objects for select to authenticated
 using(bucket_id='organization-files' and private.can_access_file(name,'organization.settings'));
create policy org_files_insert on storage.objects for insert to authenticated
 with check(bucket_id='organization-files' and private.can_access_file(name,'organization.settings') and name !~ '(^|/)\.\.(/|$)');
create policy org_files_delete on storage.objects for delete to authenticated
 using(bucket_id='organization-files' and private.can_access_file(name,'organization.settings'));
-- No UPDATE policy: clients cannot move a file between tenants or overwrite proofs.
commit;
