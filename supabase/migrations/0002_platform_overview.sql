-- =============================================================================
-- KingdomFlow — 0002: platform administration read model
-- =============================================================================
-- The platform administration screen needs cross-tenant aggregates, but every
-- tenant table is protected by row level security, so a platform admin using
-- the browser client would only ever see the tenants they personally belong to.
--
-- Rather than weakening RLS, this exposes a single read-only SECURITY DEFINER
-- function that is gated on private.is_platform_admin(). It returns aggregates
-- and a shallow organization directory — never member records, giving, pastoral
-- notes, or anything else that would turn support access into a data breach.
--
-- All mutating cross-tenant operations remain unavailable on purpose; they
-- require a separate, audited support workflow.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.platform_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT private.is_platform_admin() THEN
    RAISE EXCEPTION 'Permission required' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'organizations_count', (SELECT count(*) FROM public.organizations),
    'profiles_count',      (SELECT count(*) FROM public.profiles),
    'members_count',       (SELECT count(*) FROM public.members WHERE archived_at IS NULL),
    'active_subscriptions',(SELECT count(*) FROM public.subscriptions WHERE status IN ('active','trialing') AND ends_at > now()),
    'organizations', COALESCE((
      SELECT jsonb_agg(row_to_json(t)) FROM (
        SELECT o.id,
               o.name,
               o.organization_type,
               o.country,
               o.timezone,
               o.status,
               o.contact_count,
               o.created_at,
               p.name  AS plan_name,
               p.slug  AS plan_slug,
               s.status AS subscription_status,
               s.ends_at AS subscription_ends_at,
               (SELECT count(*) FROM public.organization_memberships m
                 WHERE m.organization_id = o.id AND m.status = 'active') AS team_size
          FROM public.organizations o
          LEFT JOIN public.subscriptions s ON s.organization_id = o.id
          LEFT JOIN public.plans p ON p.id = s.plan
         ORDER BY o.created_at DESC
         LIMIT 100
      ) t), '[]'::jsonb),
    'recent_activity', COALESCE((
      SELECT jsonb_agg(row_to_json(a)) FROM (
        SELECT l.id, l.action, l.resource_type, l.created_at,
               (SELECT name FROM public.organizations WHERE id = l.organization_id) AS organization_name
          FROM public.audit_logs l
         WHERE l.action IN ('workspace.created','staff.joined','staff.invited')
         ORDER BY l.created_at DESC
         LIMIT 20
      ) a), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END $$;

REVOKE EXECUTE ON FUNCTION public.platform_overview() FROM anon;
GRANT EXECUTE ON FUNCTION public.platform_overview() TO authenticated;
