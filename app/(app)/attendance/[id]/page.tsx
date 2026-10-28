import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, SectionHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { AttendanceRoster } from "@/components/attendance-roster";
import { QrPanel } from "@/components/qr-panel";
import { closeSession, reopenSession, archiveSession } from "@/app/actions/attendance";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission("attendance.view");
  const { id } = await params;
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("attendance_sessions")
    .select("id, title, session_date, event_id, branch_id, qr_expires_at, closed_at, created_at")
    .eq("id", id)
    .eq("organization_id", ctx.activeOrg.id)
    .maybeSingle();

  if (!session) notFound();

  const [{ data: members }, { data: records }] = await Promise.all([
    supabase
      .from("members")
      .select("id, first_name, last_name, branch_id")
      .eq("organization_id", ctx.activeOrg.id)
      .eq("status", "active")
      .is("archived_at", null)
      .order("last_name")
      .limit(500),
    supabase.from("attendance_records").select("member_id, status").eq("session_id", id),
  ]);

  const initial = Object.fromEntries(
    (records ?? []).map((record) => [record.member_id, record.status as "present" | "absent" | "excused"]),
  );
  const canManage = ctx.permissions.includes("attendance.manage");
  const closed = Boolean(session.closed_at);

  return (
    <div className="space-y-5">
      <Link href="/attendance" className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> All sessions
      </Link>

      <SectionHeader
        title={session.title}
        description={`${formatDate(session.session_date, ctx.activeOrg.timezone)} · ${(records ?? []).filter((r) => r.status === "present").length} present of ${members?.length ?? 0} on the roll`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {closed ? <Badge tone="neutral">check-in closed</Badge> : <Badge tone="success">open</Badge>}
            {canManage && !closed ? (
              <form action={closeSession}>
                <input type="hidden" name="id" value={session.id} />
                <SubmitButton size="sm" variant="secondary" pendingLabel="Closing…">
                  <Lock className="h-3.5 w-3.5" aria-hidden /> Close check-in
                </SubmitButton>
              </form>
            ) : null}
            {canManage && closed ? (
              <form action={reopenSession}>
                <input type="hidden" name="id" value={session.id} />
                <SubmitButton size="sm" variant="secondary">
                  Reopen
                </SubmitButton>
              </form>
            ) : null}
            {canManage ? (
              <form action={archiveSession}>
                <input type="hidden" name="id" value={session.id} />
                <SubmitButton size="sm" variant="ghost" pendingLabel="Archiving…">
                  Archive
                </SubmitButton>
              </form>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-3 font-display text-lg font-semibold">Roll call</h2>
          <AttendanceRoster
            sessionId={session.id}
            members={members ?? []}
            initial={initial}
            canManage={canManage}
            closed={closed}
          />
        </Card>

        <Card>
          <h2 className="font-display text-lg font-semibold">QR check-in</h2>
          <p className="mb-3 mt-1 text-xs text-ink-500">
            Print this for the entrance, or share the link with your welcome team.
          </p>
          {canManage ? (
            <QrPanel sessionId={session.id} orgId={ctx.activeOrg.id} />
          ) : (
            <p className="rounded-lg bg-ink-50 p-3 text-xs text-ink-500">
              Only roles with attendance management permission can create check-in codes.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
