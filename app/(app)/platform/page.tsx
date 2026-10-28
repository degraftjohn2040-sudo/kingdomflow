import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, SectionHeader, Stat } from "@/components/ui";
import { formatDate, formatNumber } from "@/lib/utils";
import type { PlatformOverview } from "@/lib/types";

export const metadata = { title: "Platform administration" };
export const dynamic = "force-dynamic";

/**
 * Cross-tenant read model. The browser client is subject to RLS and therefore
 * cannot see other tenants; the aggregates below come from public.platform_overview(),
 * a SECURITY DEFINER function that refuses to run for anyone absent from
 * private.platform_admins. No member, giving or pastoral data is exposed here.
 */
export default async function PlatformPage() {
  const ctx = await requireAuth();
  if (!ctx.isPlatformAdmin) redirect("/dashboard");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_overview");
  const overview = (data ?? null) as PlatformOverview | null;

  if (error || !overview) {
    return (
      <div className="space-y-5">
        <SectionHeader title="Platform administration" />
        <Card>
          <EmptyState
            title="Platform data unavailable"
            description="The platform overview could not be loaded. This usually means the deployment is not connected to the expected database."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Platform administration"
        description="Cross-tenant oversight. Access is restricted to accounts listed in private.platform_admins and every read is aggregated."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Organizations" value={formatNumber(overview.organizations_count)} />
        <Stat label="Accounts" value={formatNumber(overview.profiles_count)} />
        <Stat label="Member records" value={formatNumber(overview.members_count)} />
        <Stat
          label="Active subscriptions"
          value={formatNumber(overview.active_subscriptions)}
          tone="gold"
        />
      </div>

      <Card>
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-600" aria-hidden />
          <h2 className="font-display text-lg font-semibold">Organizations</h2>
        </div>
        {overview.organizations.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="No organizations yet"
              description="Workspaces appear here as soon as a church completes onboarding."
            />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="kf-table">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Type</th>
                  <th>Plan</th>
                  <th>Team</th>
                  <th>Members</th>
                  <th>Created</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {overview.organizations.map((org) => (
                  <tr key={org.id}>
                    <td className="font-medium text-ink-800">
                      {org.name}
                      <span className="block text-[11px] font-normal text-ink-400">
                        {org.country} · {org.timezone}
                      </span>
                    </td>
                    <td className="capitalize">{org.organization_type ?? "—"}</td>
                    <td>{org.plan_name ?? "—"}</td>
                    <td className="tabular-nums">{org.team_size}</td>
                    <td className="tabular-nums">{org.contact_count}</td>
                    <td className="text-xs">{formatDate(org.created_at)}</td>
                    <td>
                      <Badge tone={org.status === "active" ? "success" : "neutral"}>{org.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-ink-400">
          Platform support views are read-only in this release. Mutating actions across tenants require a separate
          audited support workflow and are intentionally not exposed.
        </p>
      </Card>

      <Card>
        <h2 className="font-display text-lg font-semibold">Recent onboarding activity</h2>
        {overview.recent_activity.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">No workspace or team events recorded yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink-100">
            {overview.recent_activity.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-ink-700">
                  <span className="font-medium">{row.organization_name ?? "Unknown workspace"}</span>{" "}
                  <span className="text-ink-400">· {row.action.replace(/[._]/g, " ")}</span>
                </span>
                <span className="shrink-0 text-xs text-ink-400">{formatDate(row.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
