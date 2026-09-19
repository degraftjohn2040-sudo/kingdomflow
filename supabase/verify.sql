-- Read-only provisioning checks. Run as the project administrator after migrations.
-- Every KingdomFlow table should show relrowsecurity = true.
select c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' order by c.relname;

-- Inspect all policies, including pre-existing permissive policies. PostgreSQL ORs
-- permissive policies; an older broad policy must not undermine the tenant boundary.
select schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_policies where schemaname in ('public','storage') order by tablename,policyname;

-- Should all be false. Owner/admin writes to these fields are forbidden.
select
 has_column_privilege('authenticated','public.organizations','subscription_plan','UPDATE') as can_change_plan,
 has_column_privilege('authenticated','public.organizations','subscription_status','UPDATE') as can_change_status,
 has_table_privilege('authenticated','public.organization_members','INSERT') as can_add_membership,
 has_table_privilege('authenticated','public.payments','INSERT') as can_fabricate_payment,
 has_table_privilege('anon','public.members','SELECT') as anonymous_member_read,
 has_function_privilege('anon','public.create_organization(text,text,text,text,text,text,text)','EXECUTE') as anonymous_bootstrap;

select id,name,public,file_size_limit,allowed_mime_types
from storage.buckets where id='organization-files';
select * from public.plans order by price_minor;
