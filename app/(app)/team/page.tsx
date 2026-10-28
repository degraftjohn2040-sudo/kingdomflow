import { ShieldCheck, UserPlus } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, SectionHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { InviteForm, MembershipControls } from "@/components/team-forms";
import { revokeInvitation } from "@/app/actions/team";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Team" };
export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const ctx = await requirePermission("staff.view");
  const supabase = await createClient();

  const [{ data: memberships }, { data: invitations }] = await Promise.all([
    supabase
      .from("organization_memberships")
      .select("user_id, role, status, full_name, email, joined_at, branch_ids")
      .eq("organization_id", ctx.activeOrg.id)
      .order("created_at"),
    supabase
      .from("organization_invitations")
      .select("id, email, role, expires_at, accepted_at, revoked_at, created_at")
      .eq("organization_id", ctx.activeOrg.id)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const canManage = ctx.permissions.includes("staff.manage");

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Team & permissions"
        description="Staff accounts, roles and pending invitations. Roles are enforced in the database."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="font-display text-lg font-semibold">Team members</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="kf-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th>{canManage ? "Manage" : "Status"}</th>
                </tr>
              </thead>
              <tbody>
                {(memberships ?? []).map((person) => (
                  <tr key={person.user_id}>
                    <td>
                      <p className="text-sm font-medium text-ink-800">{person.full_name ?? "Team member"}</p>
                      <p className="text-[11px] text-ink-400">{person.email ?? "—"}</p>
                    </td>
                    <td>
                      <Badge tone={person.role === "owner" ? "gold" : "info"}>
                        {ROLE_LABELS[person.role as Role] ?? person.role}
                      </Badge>
                    </td>
                    <td className="text-xs">{formatDate(person.joined_at, ctx.activeOrg.timezone)}</td>
                    <td>
                      {canManage ? (
                        <MembershipControls
                          userId={person.user_id}
                          role={person.role}
                          status={person.status}
                          isSelf={person.user_id === ctx.user.id}
                        />
                      ) : (
                        <Badge tone={person.status === "active" ? "success" : "neutral"}>{person.status}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {canManage ? (
          <Card>
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-royal-700" aria-hidden />
              <h2 className="font-display text-lg font-semibold">Invite staff</h2>
            </div>
            <div className="mt-3">
              <InviteForm />
            </div>
          </Card>
        ) : null}
      </div>

      <Card>
        <h2 className="font-display text-lg font-semibold">Pending invitations</h2>
        {!invitations || invitations.length === 0 ? (
          <EmptyState title="No pending invitations" description="Invitations you create will appear here until accepted or expired." />
        ) : (
          <ul className="mt-3 divide-y divide-ink-100">
            {invitations.map((invite) => {
              const expired = new Date(invite.expires_at).getTime() < Date.now();
              return (
                <li key={invite.id} className="flex flex-wrap items-center gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-800">{invite.email}</p>
                    <p className="text-[11px] text-ink-400">
                      {ROLE_LABELS[invite.role as Role] ?? invite.role} · expires {formatDate(invite.expires_at, ctx.activeOrg.timezone)}
                    </p>
                  </div>
                  <Badge tone={expired ? "warning" : "info"}>{expired ? "expired" : "pending"}</Badge>
                  {canManage ? (
                    <form action={revokeInvitation}>
                      <input type="hidden" name="id" value={invite.id} />
                      <SubmitButton size="sm" variant="ghost" pendingLabel="Revoking…">
                        Revoke
                      </SubmitButton>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-ink-500" aria-hidden />
          <h2 className="font-display text-lg font-semibold">What each role can do</h2>
        </div>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(ROLE_DESCRIPTIONS).map(([role, description]) => (
            <div key={role} className="rounded-lg bg-ink-50 p-3">
              <dt className="text-xs font-semibold text-ink-800">{ROLE_LABELS[role as Role]}</dt>
              <dd className="mt-1 text-[11px] leading-relaxed text-ink-500">{description}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
