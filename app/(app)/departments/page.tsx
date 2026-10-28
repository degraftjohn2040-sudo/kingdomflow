import { FolderTree, Users } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, SectionHeader } from "@/components/ui";
import { DepartmentForm } from "@/components/department-form";
import { SubmitButton } from "@/components/submit-button";
import { archiveDepartment } from "@/app/actions/structure";
import type { BranchRow, DepartmentRow } from "@/lib/types";

export const metadata = { title: "Departments" };
export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  const ctx = await requirePermission("department.view");
  const supabase = await createClient();

  const [{ data: departments }, { data: branches }, { data: members }, { data: links }] = await Promise.all([
    supabase
      .from("departments")
      .select("id, name, slug, type, description, branch_id, leader_id, status")
      .eq("organization_id", ctx.activeOrg.id)
      .order("name"),
    supabase.from("branches").select("id, name").eq("organization_id", ctx.activeOrg.id).order("name"),
    supabase
      .from("members")
      .select("id, first_name, last_name")
      .eq("organization_id", ctx.activeOrg.id)
      .is("archived_at", null)
      .order("last_name")
      .limit(500),
    supabase.from("department_members").select("department_id, member_id"),
  ]);

  const memberName = (id: string | null) => {
    const member = (members ?? []).find((m) => m.id === id);
    return member ? `${member.first_name} ${member.last_name}` : null;
  };
  const counts = new Map<string, number>();
  for (const link of links ?? []) counts.set(link.department_id, (counts.get(link.department_id) ?? 0) + 1);

  const canManage = ctx.permissions.includes("department.manage");

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Departments & ministry"
        description="Choirs, ushering, youth, outreach and follow-up teams with their own leaders and rosters."
        action={
          canManage ? (
            <DepartmentForm
              branches={(branches ?? []) as BranchRow[]}
              members={(members ?? []).map((m) => ({ id: m.id, name: `${m.first_name} ${m.last_name}` }))}
            />
          ) : undefined
        }
      />

      {!departments || departments.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FolderTree className="h-8 w-8" />}
            title="No departments yet"
            description="Create departments to organize ministry teams and report on their activity."
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {(departments as DepartmentRow[]).map((dept) => (
            <Card key={dept.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-display text-base font-semibold">{dept.name}</h2>
                <Badge tone={dept.status === "active" ? "success" : "neutral"}>{dept.status}</Badge>
              </div>
              <p className="mt-0.5 text-[11px] uppercase tracking-wide text-ink-400">{dept.type.replace(/_/g, " ")}</p>
              {dept.description ? <p className="mt-2 line-clamp-2 text-sm text-ink-600">{dept.description}</p> : null}
              <dl className="mt-3 space-y-1 text-xs text-ink-500">
                <div className="flex items-center gap-1.5">
                  <Users className="h-3 w-3" aria-hidden />
                  {counts.get(dept.id) ?? 0} member(s)
                </div>
                <div>Leader: {memberName(dept.leader_id) ?? "Unassigned"}</div>
                <div>
                  {(branches as BranchRow[] | null)?.find((b) => b.id === dept.branch_id)?.name ?? "Organization-wide"}
                </div>
              </dl>
              {canManage && dept.status === "active" ? (
                <form action={archiveDepartment} className="mt-3 border-t border-ink-100 pt-2">
                  <input type="hidden" name="id" value={dept.id} />
                  <SubmitButton size="sm" variant="ghost" pendingLabel="Archiving…">
                    Archive
                  </SubmitButton>
                </form>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
