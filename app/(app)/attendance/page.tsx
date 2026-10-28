import Link from "next/link";
import { CalendarCheck, ClipboardCheck, Plus } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, ButtonLink, Card, EmptyState, SectionHeader } from "@/components/ui";
import { SessionForm } from "@/components/session-form";
import { formatDate } from "@/lib/utils";
import type { SessionRow } from "@/lib/types";

export const metadata = { title: "Attendance" };
export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const ctx = await requirePermission("attendance.view");
  const supabase = await createClient();

  const { data: sessions } = await supabase
    .from("attendance_sessions")
    .select("id, title, session_date, event_id, branch_id, qr_expires_at, closed_at, created_at")
    .eq("organization_id", ctx.activeOrg.id)
    .is("archived_at", null)
    .order("session_date", { ascending: false })
    .limit(30);

  const ids = (sessions ?? []).map((s) => s.id);
  const { data: counts } = ids.length
    ? await supabase.from("attendance_records").select("session_id, status").in("session_id", ids)
    : { data: [] as Array<{ session_id: string; status: string }> };

  const tally = new Map<string, number>();
  for (const record of counts ?? []) {
    if (record.status === "present") tally.set(record.session_id, (tally.get(record.session_id) ?? 0) + 1);
  }

  const canManage = ctx.permissions.includes("attendance.manage");

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Attendance"
        description="Services, fellowship meetings and department gatherings — recorded once, reportable always."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {canManage ? (
          <Card className="lg:col-span-1">
            <h2 className="font-display text-lg font-semibold">New session</h2>
            <p className="mb-4 mt-1 text-xs text-ink-500">
              Create a session, then take the roll online or on paper and enter it later.
            </p>
            <SessionForm />
          </Card>
        ) : null}

        <Card className={canManage ? "lg:col-span-2" : "lg:col-span-3"}>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Recent sessions</h2>
            <span className="text-[11px] uppercase tracking-wider text-ink-400">last 30</span>
          </div>
          {!sessions || sessions.length === 0 ? (
            <EmptyState
              icon={<ClipboardCheck className="h-7 w-7" />}
              title="No sessions recorded"
              description="Create your first attendance session for a Sunday service or midweek meeting."
            />
          ) : (
            <ul className="mt-3 divide-y divide-ink-100">
              {(sessions as SessionRow[]).map((session) => (
                <li key={session.id} className="flex items-center gap-3 py-2.5">
                  <CalendarCheck className="h-4 w-4 shrink-0 text-ink-300" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/attendance/${session.id}`}
                      className="block truncate text-sm font-semibold text-ink-800 hover:text-royal-700 hover:underline"
                    >
                      {session.title}
                    </Link>
                    <p className="text-xs text-ink-500">{formatDate(session.session_date, ctx.activeOrg.timezone)}</p>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-ink-600">{tally.get(session.id) ?? 0} present</span>
                  {session.closed_at ? <Badge tone="neutral">closed</Badge> : <Badge tone="success">open</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {canManage ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 bg-royal-50/60">
          <div>
            <h2 className="font-display text-base font-semibold">Check-in page</h2>
            <p className="text-xs text-ink-600">
              Staff and linked members can scan a session QR code to check in from their phone.
            </p>
          </div>
          <ButtonLink href="/checkin" size="sm" variant="secondary">
            <Plus className="h-3.5 w-3.5" aria-hidden /> Open check-in
          </ButtonLink>
        </Card>
      ) : null}
    </div>
  );
}
