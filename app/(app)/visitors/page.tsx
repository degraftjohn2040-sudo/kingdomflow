import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, SectionHeader } from "@/components/ui";
import { VisitorForm, VisitorFollowupControl } from "@/components/people-forms";
import { ConvertVisitorButton } from "@/components/member-detail-actions";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Visitors" };
export const dynamic = "force-dynamic";

type Visitor = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  visit_date: string;
  invited_by: string | null;
  how_heard: string | null;
  consent_given: boolean;
  converted_member_id: string | null;
  followup_status: string | null;
  branch_id: string | null;
};

const TONE: Record<string, "success" | "warning" | "info" | "neutral"> = {
  new: "info",
  contacted: "warning",
  scheduled: "warning",
  converted: "success",
  closed: "neutral",
};

export default async function VisitorsPage() {
  const ctx = await requirePermission("visitor.view");
  const supabase = await createClient();

  const [{ data: visitors }, { data: branches }] = await Promise.all([
    supabase
      .from("visitors")
      .select(
        "id, first_name, last_name, email, phone, visit_date, invited_by, how_heard, consent_given, converted_member_id, followup_status, branch_id",
      )
      .eq("organization_id", ctx.activeOrg.id)
      .order("visit_date", { ascending: false })
      .limit(60),
    supabase.from("branches").select("id, name").eq("organization_id", ctx.activeOrg.id).order("name"),
  ]);

  const rows = (visitors ?? []) as Visitor[];
  const canManage = ctx.permissions.includes("visitor.manage");
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = rows.filter((v) => v.visit_date.slice(0, 7) === today.slice(0, 7)).length;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Visitors"
        description="Every first-timer, how they found you, and whether anyone followed up."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-0">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="font-display text-lg font-semibold">Recent visitors</h2>
              <Badge tone="gold">{thisMonth} this month</Badge>
            </div>
            {rows.length === 0 ? (
              <div className="px-5 pb-5">
                <EmptyState
                  title="No visitors recorded yet"
                  description="Record a first-timer from the form and assign someone to follow up."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="kf-table">
                  <thead>
                    <tr>
                      <th>Visitor</th>
                      <th>First visit</th>
                      <th>Source</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((v) => (
                      <tr key={v.id}>
                        <td>
                          <span className="font-medium text-ink-800">
                            {v.first_name} {v.last_name}
                          </span>
                          <span className="block text-[11px] text-ink-400">
                            {v.phone || v.email || "No contact details"}
                            {v.consent_given ? "" : " · no contact consent"}
                          </span>
                        </td>
                        <td className="text-xs">{formatDate(v.visit_date, ctx.activeOrg.timezone)}</td>
                        <td className="text-xs">
                          {v.how_heard || "—"}
                          {v.invited_by ? <span className="block text-ink-400">by {v.invited_by}</span> : null}
                        </td>
                        <td>
                          {v.converted_member_id ? (
                            <Badge tone="success">member</Badge>
                          ) : (
                            <Badge tone={TONE[v.followup_status ?? "new"] ?? "neutral"}>
                              {v.followup_status ?? "new"}
                            </Badge>
                          )}
                        </td>
                        <td>
                          <div className="flex justify-end gap-2">
                            {canManage && !v.converted_member_id ? (
                              <>
                                <VisitorFollowupControl id={v.id} status={v.followup_status ?? "new"} />
                                <ConvertVisitorButton
                                  id={v.id}
                                  first_name={v.first_name}
                                  last_name={v.last_name}
                                />
                              </>
                            ) : v.converted_member_id ? (
                              <Link
                                href={`/members/${v.converted_member_id}`}
                                className="text-xs font-semibold text-royal-700 hover:underline"
                              >
                                Open member
                              </Link>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <Card>
          <h2 className="font-display text-lg font-semibold">Record a visitor</h2>
          <p className="mb-4 mt-1 text-xs text-ink-500">
            Only record what the visitor agreed to share, and ask before adding them to a mailing list.
          </p>
          {canManage ? (
            <VisitorForm branches={(branches ?? []) as Array<{ id: string; name: string }>} today={today} />
          ) : (
            <EmptyState title="Read-only access" description="You can view visitors but not add new ones." />
          )}
        </Card>
      </div>
    </div>
  );
}
