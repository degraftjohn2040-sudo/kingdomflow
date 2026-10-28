import { Church } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, SectionHeader } from "@/components/ui";
import { BranchForm } from "@/components/branch-form";
import type { BranchRow } from "@/lib/types";

export const metadata = { title: "Branches" };
export const dynamic = "force-dynamic";

export default async function BranchesPage() {
  const ctx = await requirePermission("branch.view");
  const supabase = await createClient();

  const [{ data: branches }, { data: members }] = await Promise.all([
    supabase
      .from("branches")
      .select("id, name, slug, city, address, phone, email, is_main, status")
      .eq("organization_id", ctx.activeOrg.id)
      .order("is_main", { ascending: false })
      .order("name"),
    supabase.from("members").select("branch_id").eq("organization_id", ctx.activeOrg.id).is("archived_at", null),
  ]);

  const counts = new Map<string, number>();
  for (const member of members ?? []) {
    if (member.branch_id) counts.set(member.branch_id, (counts.get(member.branch_id) ?? 0) + 1);
  }
  const unrestricted = (ctx.membership?.branch_ids ?? []).length === 0;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Branches"
        description="Each branch keeps its own profile, leadership, members, events and reporting scope."
        action={ctx.permissions.includes("branch.manage") ? <BranchForm /> : undefined}
      />

      {!unrestricted ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Your account is scoped to specific branches. You will only see records belonging to those branches.
        </p>
      ) : null}

      {!branches || branches.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Church className="h-8 w-8" />}
            title="No branches yet"
            description="Add a branch to segment members, attendance and giving by location."
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {(branches as BranchRow[]).map((branch) => (
            <Card key={branch.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-semibold">{branch.name}</h2>
                  <p className="text-xs text-ink-500">{branch.city ?? "No city set"}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {branch.is_main ? <Badge tone="gold">main</Badge> : null}
                  <Badge tone={branch.status === "active" ? "success" : "neutral"}>{branch.status}</Badge>
                </div>
              </div>
              <dl className="mt-3 space-y-1 text-xs text-ink-500">
                <div>{counts.get(branch.id) ?? 0} member(s)</div>
                <div>{branch.address ?? "No address"}</div>
                <div>{branch.phone ?? branch.email ?? "No contact"}</div>
              </dl>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
