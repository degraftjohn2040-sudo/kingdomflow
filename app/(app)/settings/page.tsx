import Link from "next/link";
import { requireWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, SectionHeader } from "@/components/ui";
import { OrganizationSettingsForm, ProfileForm } from "@/components/settings-forms";
import { ROLE_LABELS, type Role } from "@/lib/permissions";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await requireWorkspace();
  const supabase = await createClient();

  const [{ data: profile }, { data: subscription }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone, is_platform_admin").eq("id", ctx.user.id).maybeSingle(),
    supabase
      .from("subscriptions")
      .select("status, ends_at, plans(name, max_contacts, max_branches, max_users)")
      .eq("organization_id", ctx.activeOrg.id)
      .maybeSingle(),
  ]);

  const plan = (subscription?.plans ?? null) as
    | { name: string; max_contacts: number; max_branches: number; max_users: number }
    | null;

  const canManage = ctx.permissions.includes("org.manage");

  return (
    <div className="space-y-5">
      <SectionHeader title="Settings" description="Organization profile, your account and the current plan." />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="font-display text-lg font-semibold">Organization</h2>
          <p className="mb-4 mt-1 text-xs text-ink-500">
            These details appear on receipts, reports and the sign-in experience for your staff.
          </p>
          <OrganizationSettingsForm org={ctx.activeOrg} canManage={canManage} />
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="font-display text-lg font-semibold">Your plan</h2>
            <div className="mt-2 flex items-center gap-2">
              <Badge tone="gold">{plan?.name ?? "Free"}</Badge>
              <Badge tone={subscription?.status === "active" ? "success" : "neutral"}>
                {subscription?.status ?? "active"}
              </Badge>
            </div>
            <dl className="mt-3 space-y-1.5 text-xs text-ink-600">
              <div className="flex justify-between">
                <dt>Member records</dt>
                <dd className="font-semibold">
                  {ctx.activeOrg.contact_count} / {plan?.max_contacts ?? 500}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Branches</dt>
                <dd className="font-semibold">{plan?.max_branches ?? 1}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Staff accounts</dt>
                <dd className="font-semibold">{plan?.max_users ?? 3}</dd>
              </div>
            </dl>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-400">
              Plan changes and billing are handled by the platform administrator. No payment provider is connected in
              this deployment.
            </p>
          </Card>

          <Card>
            <h2 className="font-display text-lg font-semibold">Your account</h2>
            <div className="mt-2 flex items-center gap-2 text-xs text-ink-500">
              <span className="font-mono">{ctx.user.email}</span>
              <Badge tone="info">{ROLE_LABELS[(ctx.role ?? "viewer") as Role] ?? ctx.role}</Badge>
            </div>
            <div className="mt-4">
              <ProfileForm
                fullName={profile?.full_name ?? ctx.user.fullName}
                phone={profile?.phone ?? ""}
              />
            </div>
          </Card>

          <Card>
            <h2 className="font-display text-lg font-semibold">Administration</h2>
            <ul className="mt-2 space-y-1.5 text-sm">
              {ctx.permissions.includes("staff.view") ? (
                <li>
                  <Link href="/team" className="text-royal-700 hover:underline">
                    Team & permissions
                  </Link>
                </li>
              ) : null}
              {ctx.permissions.includes("org.audit_logs") ? (
                <li>
                  <Link href="/audit" className="text-royal-700 hover:underline">
                    Audit log
                  </Link>
                </li>
              ) : null}
              {ctx.isPlatformAdmin ? (
                <li>
                  <Link href="/platform" className="text-royal-700 hover:underline">
                    Platform administration
                  </Link>
                </li>
              ) : null}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
