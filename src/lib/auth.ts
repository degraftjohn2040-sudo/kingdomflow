import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/config';
export const requireUser = cache(async () => {
  if (!supabaseConfigured()) redirect('/configuration');
  const db = await createClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) redirect('/login');
  return { db, user };
});
export const getWorkspace = cache(async () => {
  const { db, user } = await requireUser();
  const { data: memberships, error } = await db
    .from('organization_members')
    .select('organization_id,role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at');
  if (error) throw new Error('Workspace unavailable. Check database migrations and permissions.');
  if (!memberships?.length) redirect('/onboarding');
  const selected = (await cookies()).get('kf-workspace')?.value;
  const membership = memberships.find((m) => m.organization_id === selected) ?? memberships[0];
  const { data: organization, error: orgError } = await db
    .from('organizations')
    .select('*')
    .eq('id', membership.organization_id)
    .single();
  if (orgError || !organization) throw new Error('Workspace unavailable. Please try again.');
  return { db, user, organization, role: String(membership.role), memberships };
});
export const allowed = cache(async (permission: string) => {
  const ctx = await getWorkspace();
  const { data, error } = await ctx.db.rpc('authorize', {
    organization: ctx.organization.id,
    permission,
  });
  if (error) throw new Error('Permission check failed. Check database configuration.');
  return data === true;
});
export async function requirePermission(permission: string, feature?: string) {
  const ctx = await getWorkspace();
  if (!(await allowed(permission)))
    throw new Error('Permission Required: your role cannot perform this operation.');
  if (feature) {
    const { data, error } = await ctx.db.rpc('entitled', {
      organization: ctx.organization.id,
      feature,
    });
    if (error) throw new Error('Subscription verification failed.');
    if (data !== true)
      throw new Error(
        'An active plan with this feature is required. Visit Billing for your subscription status.',
      );
  }
  return ctx;
}
