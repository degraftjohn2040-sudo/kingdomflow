import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AuthContext, Membership, Organization } from "@/lib/types";
import type { Permission } from "@/lib/permissions";

export const ORG_COOKIE = "kf_org";

/**
 * Resolves the caller's identity, organizations, active tenant and effective permissions.
 * Every value comes from the database under RLS — nothing is trusted from the browser.
 */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: membershipRows }] = await Promise.all([
    supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).maybeSingle(),
    supabase
      .from("organization_memberships")
      .select("organization_id, user_id, role, status, branch_ids, full_name, email")
      .eq("user_id", user.id)
      .eq("status", "active"),
  ]);

  const memberships = (membershipRows ?? []) as Membership[];
  const orgIds = memberships.map((m) => m.organization_id);

  let organizations: Organization[] = [];
  if (orgIds.length > 0) {
    const { data } = await supabase
      .from("organizations")
      .select(
        "id, name, slug, description, logo_url, currency, timezone, country, city, address, phone, email, website, plan, status, denomination, organization_type, onboarding_complete, contact_count",
      )
      .in("id", orgIds)
      .order("name");
    organizations = (data ?? []) as Organization[];
  }

  const cookieStore = await cookies();
  const requested = cookieStore.get(ORG_COOKIE)?.value;
  const activeOrg = organizations.find((o) => o.id === requested) ?? organizations[0] ?? null;
  const membership = memberships.find((m) => m.organization_id === activeOrg?.id) ?? null;

  let permissions: string[] = [];
  if (activeOrg) {
    const { data } = await supabase.rpc("my_permissions", { target_org: activeOrg.id });
    permissions = ((data ?? []) as string[])
      .map((entry) => entry.split(":").slice(1).join(":"))
      .filter(Boolean);
  }

  const { data: platformAdmin } = await supabase.rpc("am_i_platform_admin");

  return {
    user: {
      id: user.id,
      email: user.email ?? "",
      fullName: profile?.full_name || (user.user_metadata?.full_name as string) || user.email || "",
      avatarUrl: profile?.avatar_url ?? null,
    },
    organizations: organizations.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      role: memberships.find((m) => m.organization_id === o.id)?.role ?? "viewer",
      timezone: o.timezone,
      currency: o.currency,
    })),
    activeOrg,
    membership,
    permissions,
    role: membership?.role ?? null,
    isPlatformAdmin: platformAdmin === true,
  };
});

export async function requireAuth() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  return ctx;
}

/** Requires a signed-in user with at least one active organization. */
export async function requireWorkspace() {
  const ctx = await requireAuth();
  if (!ctx.activeOrg) redirect("/onboarding");
  return { ...ctx, activeOrg: ctx.activeOrg };
}

export class PermissionError extends Error {
  constructor(public permission: Permission) {
    super(`Missing permission: ${permission}`);
  }
}

/** Server-side permission gate. UI checks are cosmetic; this one is authoritative. */
export async function requirePermission(permission: Permission) {
  const ctx = await requireWorkspace();
  if (!ctx.permissions.includes(permission)) {
    throw new PermissionError(permission);
  }
  return ctx;
}

export async function hasPermission(permission: Permission) {
  const ctx = await getAuthContext();
  return Boolean(ctx?.permissions.includes(permission));
}
