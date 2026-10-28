import { ShieldCheck } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, SectionHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const ctx = await requirePermission("org.audit_logs");
  const supabase = await createClient();

  const { data: logs } = await supabase
    .from("audit_logs")
    .select("id, action, resource_type, resource_id, details, created_at, user_id")
    .eq("organization_id", ctx.activeOrg.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Audit log"
        description="Privilege changes, member archives, financial entries and onboarding events for this organization."
      />

      <Card>
        {!logs || logs.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="h-7 w-7" />}
            title="No audit entries yet"
            description="Sensitive actions such as role changes and record archiving will be recorded here."
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {logs.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-start gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink-800">{entry.action}</p>
                  <p className="text-[11px] text-ink-400">
                    {entry.resource_type}
                    {entry.resource_id ? ` · ${entry.resource_id.slice(0, 8)}…` : ""} ·{" "}
                    {formatDateTime(entry.created_at, ctx.activeOrg.timezone)}
                  </p>
                  {entry.details ? (
                    <pre className="mt-1 overflow-x-auto rounded bg-ink-50 p-1.5 text-[10px] text-ink-500">
                      {JSON.stringify(entry.details)}
                    </pre>
                  ) : null}
                </div>
                <Badge tone="neutral">{entry.user_id ? entry.user_id.slice(0, 8) : "system"}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
