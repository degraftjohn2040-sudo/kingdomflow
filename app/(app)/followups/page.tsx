import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, SectionHeader } from "@/components/ui";
import { FollowupForm } from "@/components/people-forms";
import { FollowupStatusButtons } from "@/components/member-detail-actions";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Follow-ups" };
export const dynamic = "force-dynamic";

type Followup = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  status: string;
  due_date: string | null;
  assigned_to: string | null;
  member_id: string | null;
  created_at: string;
};

const PRIORITY_TONE: Record<string, "danger" | "warning" | "neutral"> = {
  high: "danger",
  medium: "warning",
  low: "neutral",
};

export default async function FollowupsPage() {
  const ctx = await requirePermission("followup.view");
  const supabase = await createClient();

  const [{ data: followups }, { data: members }, { data: staff }] = await Promise.all([
    supabase
      .from("followups")
      .select("id, title, description, type, priority, status, due_date, assigned_to, member_id, created_at")
      .eq("organization_id", ctx.activeOrg.id)
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("members")
      .select("id, first_name, last_name")
      .eq("organization_id", ctx.activeOrg.id)
      .is("archived_at", null)
      .order("last_name")
      .limit(500),
    supabase
      .from("organization_memberships")
      .select("user_id, full_name")
      .eq("organization_id", ctx.activeOrg.id)
      .eq("status", "active"),
  ]);

  const rows = (followups ?? []) as Followup[];
  const canManage = ctx.permissions.includes("followup.manage");
  const nameById = new Map<string, string>();
  for (const m of (members ?? []) as Array<{ id: string; first_name: string; last_name: string }>) {
    nameById.set(m.id, `${m.first_name} ${m.last_name}`);
  }
  const staffById = new Map<string, string>();
  for (const s of (staff ?? []) as Array<{ user_id: string; full_name: string | null }>) {
    staffById.set(s.user_id, s.full_name ?? "Team member");
  }

  const open = rows.filter((r) => r.status === "open" || r.status === "in_progress");
  const overdue = open.filter((r) => r.due_date && r.due_date < new Date().toISOString().slice(0, 10));

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Follow-ups"
        description="Pastoral care that does not get lost: who is being contacted, by whom, and by when."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4">
              <p className="text-xs text-ink-500">Open</p>
              <p className="font-display text-2xl font-semibold">{open.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-ink-500">Overdue</p>
              <p className="font-display text-2xl font-semibold text-red-600">{overdue.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-ink-500">Completed</p>
              <p className="font-display text-2xl font-semibold text-emerald-600">
                {rows.filter((r) => r.status === "done").length}
              </p>
            </Card>
          </div>

          <Card className="p-0">
            <h2 className="px-5 py-4 font-display text-lg font-semibold">Care queue</h2>
            {rows.length === 0 ? (
              <div className="px-5 pb-5">
                <EmptyState
                  title="No follow-ups yet"
                  description="Create one when someone needs a call, a visit or a prayer."
                />
              </div>
            ) : (
              <ul className="divide-y divide-ink-100">
                {rows.map((f) => {
                  const isOverdue = f.due_date && f.due_date < new Date().toISOString().slice(0, 10) && f.status !== "done";
                  return (
                    <li key={f.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink-800">
                          {f.title}
                          <Badge tone={PRIORITY_TONE[f.priority] ?? "neutral"}>{f.priority}</Badge>
                          <Badge tone={f.status === "done" ? "success" : f.status === "open" ? "info" : "neutral"}>
                            {f.status.replace("_", " ")}
                          </Badge>
                        </p>
                        <p className="mt-0.5 text-[11px] text-ink-400">
                          {f.type}
                          {f.member_id ? ` · ${nameById.get(f.member_id) ?? "member"}` : ""}
                          {f.assigned_to ? ` · ${staffById.get(f.assigned_to) ?? "unassigned"}` : ""}
                          {f.due_date ? ` · due ${formatDate(f.due_date, ctx.activeOrg.timezone)}` : ""}
                          {isOverdue ? " · overdue" : ""}
                        </p>
                        {f.description ? (
                          <p className="mt-1 line-clamp-2 text-xs text-ink-600">{f.description}</p>
                        ) : null}
                      </div>
                      {canManage && f.status !== "done" ? <FollowupStatusButtons id={f.id} /> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <Card>
          <h2 className="font-display text-lg font-semibold">New follow-up</h2>
          <p className="mb-4 mt-1 text-xs text-ink-500">
            Assign an owner so someone is visibly responsible, and set a due date.
          </p>
          {canManage ? (
            <FollowupForm
              members={(members ?? []).map((m) => ({
                id: m.id as string,
                name: `${m.first_name} ${m.last_name}`,
              }))}
              staff={[...staffById.entries()].map(([id, name]) => ({ id, name }))}
            />
          ) : (
            <EmptyState title="Read-only access" description="Ask an administrator for follow-up permission." />
          )}
        </Card>
      </div>
    </div>
  );
}
