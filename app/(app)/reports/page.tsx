import Link from "next/link";
import { FileBarChart, TrendingUp } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, SectionHeader, Stat } from "@/components/ui";
import { formatDate, formatMoney, formatNumber } from "@/lib/utils";

export const metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

function isoDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const ctx = await requirePermission("report.view");
  const params = await searchParams;
  const to = params.to ?? new Date().toISOString().slice(0, 10);
  const from = params.from ?? isoDaysAgo(30);

  const supabase = await createClient();
  const canFinance = ctx.permissions.includes("finance.view");

  const [{ data: sessions }, { data: records }, { data: branches }, { data: members }, { data: absentees }, finance] =
    await Promise.all([
      supabase
        .from("attendance_sessions")
        .select("id, title, session_date, branch_id")
        .eq("organization_id", ctx.activeOrg.id)
        .gte("session_date", from)
        .lte("session_date", to)
        .order("session_date", { ascending: false })
        .limit(100),
      supabase.from("attendance_records").select("session_id, status, member_id"),
      supabase.from("branches").select("id, name").eq("organization_id", ctx.activeOrg.id),
      supabase.from("members").select("id, branch_id, created_at, status").eq("organization_id", ctx.activeOrg.id),
      supabase.rpc("recurring_absentees", { target_org: ctx.activeOrg.id, p_from: from, p_to: to }),
      canFinance
        ? Promise.all([
            supabase
              .from("contributions")
              .select("amount, category, given_at")
              .eq("organization_id", ctx.activeOrg.id)
              .gte("given_at", from)
              .lte("given_at", to),
            supabase
              .from("expense_records")
              .select("amount, category, incurred_at")
              .eq("organization_id", ctx.activeOrg.id)
              .gte("incurred_at", from)
              .lte("incurred_at", to),
          ])
        : Promise.resolve(null),
    ]);

  const sessionIds = new Set((sessions ?? []).map((s) => s.id));
  const tally = new Map<string, { present: number; absent: number }>();
  for (const record of records ?? []) {
    if (!sessionIds.has(record.session_id)) continue;
    const bucket = tally.get(record.session_id) ?? { present: 0, absent: 0 };
    if (record.status === "present") bucket.present += 1;
    else bucket.absent += 1;
    tally.set(record.session_id, bucket);
  }

  const totalPresent = [...tally.values()].reduce((sum, bucket) => sum + bucket.present, 0);
  const totalMarked = [...tally.values()].reduce((sum, bucket) => sum + bucket.present + bucket.absent, 0);
  const rate = totalMarked > 0 ? Math.round((totalPresent / totalMarked) * 100) : 0;

  const byBranch = new Map<string, number>();
  for (const member of members ?? []) {
    const key = member.branch_id ?? "unassigned";
    byBranch.set(key, (byBranch.get(key) ?? 0) + 1);
  }

  const contributions = finance?.[0].data ?? [];
  const expenses = finance?.[1].data ?? [];
  const totalIn = contributions.reduce((sum, row) => sum + Number(row.amount), 0);
  const totalOut = expenses.reduce((sum, row) => sum + Number(row.amount), 0);

  const categoryTotals = new Map<string, number>();
  for (const row of contributions) {
    categoryTotals.set(row.category, (categoryTotals.get(row.category) ?? 0) + Number(row.amount));
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Reports"
        description="Attendance, membership and finance for the selected period, in the organization timezone."
        action={
          <form className="flex items-end gap-2" action="/reports">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">
              From
              <input type="date" name="from" defaultValue={from} className="kf-input mt-1 h-9 w-auto py-0 text-xs" />
            </label>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">
              To
              <input type="date" name="to" defaultValue={to} className="kf-input mt-1 h-9 w-auto py-0 text-xs" />
            </label>
            <button className="h-9 rounded-lg bg-ink-900 px-3 text-xs font-semibold text-white">Apply</button>
          </form>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sessions" value={formatNumber(sessions?.length ?? 0)} hint={`${formatDate(from)} – ${formatDate(to)}`} />
        <Stat label="Present marks" value={formatNumber(totalPresent)} />
        <Stat label="Attendance rate" value={`${rate}%`} hint="of recorded marks" />
        <Stat label="Members" value={formatNumber(members?.length ?? 0)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-lg font-semibold">Attendance by session</h2>
          {!sessions || sessions.length === 0 ? (
            <EmptyState
              icon={<FileBarChart className="h-7 w-7" />}
              title="No sessions in this period"
              description="Adjust the date range or create an attendance session."
            />
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="kf-table">
                <thead>
                  <tr>
                    <th>Session</th>
                    <th>Date</th>
                    <th>Branch</th>
                    <th className="text-right">Present</th>
                    <th className="text-right">Marked</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => {
                    const bucket = tally.get(session.id) ?? { present: 0, absent: 0 };
                    return (
                      <tr key={session.id}>
                        <td>
                          <Link href={`/attendance/${session.id}`} className="font-medium hover:text-royal-700 hover:underline">
                            {session.title}
                          </Link>
                        </td>
                        <td className="text-xs">{formatDate(session.session_date, ctx.activeOrg.timezone)}</td>
                        <td className="text-xs">
                          {branches?.find((b) => b.id === session.branch_id)?.name ?? "—"}
                        </td>
                        <td className="text-right tabular-nums">{bucket.present}</td>
                        <td className="text-right tabular-nums">{bucket.present + bucket.absent}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="font-display text-lg font-semibold">Members by branch</h2>
            <ul className="mt-3 space-y-2">
              {(branches ?? []).map((branch) => {
                const count = byBranch.get(branch.id) ?? 0;
                const total = Math.max(1, members?.length ?? 0);
                return (
                  <li key={branch.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-ink-700">{branch.name}</span>
                      <span className="tabular-nums text-ink-500">{count}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
                      <div className="h-full rounded-full bg-royal-600" style={{ width: `${(count / total) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
              {byBranch.get("unassigned") ? (
                <li className="flex items-center justify-between text-sm">
                  <span className="text-ink-700">Organization-wide</span>
                  <span className="tabular-nums text-ink-500">{byBranch.get("unassigned")}</span>
                </li>
              ) : null}
            </ul>
          </Card>

          <Card>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-600" aria-hidden />
              <h2 className="font-display text-lg font-semibold">Needs follow-up</h2>
            </div>
            <p className="mt-1 text-xs text-ink-500">
              Active members with no attendance marks in this period
              {Array.isArray(absentees) ? ` (${absentees.length})` : ""}.
            </p>
            {!Array.isArray(absentees) || absentees.length === 0 ? (
              <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">
                Everyone on the active roll has been marked present at least once in this period.
              </p>
            ) : (
              <ul className="mt-3 max-h-52 space-y-1.5 overflow-auto">
                {(absentees as Array<{ id: string; first_name: string; last_name: string }>).map((person) => (
                  <li key={person.id} className="flex items-center justify-between text-sm">
                    <Link href={`/members/${person.id}`} className="text-ink-700 hover:text-royal-700 hover:underline">
                      {person.first_name} {person.last_name}
                    </Link>
                    <Badge tone="warning">no mark</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {canFinance ? (
        <Card>
          <h2 className="font-display text-lg font-semibold">Finance summary</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-emerald-700">Contributions</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{formatMoney(totalIn, ctx.activeOrg.currency)}</p>
            </div>
            <div className="rounded-lg bg-red-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-red-700">Expenses</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{formatMoney(totalOut, ctx.activeOrg.currency)}</p>
            </div>
            <div className="rounded-lg bg-ink-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-ink-500">Net</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {formatMoney(totalIn - totalOut, ctx.activeOrg.currency)}
              </p>
            </div>
          </div>
          <table className="kf-table mt-4">
            <thead>
              <tr>
                <th>Category</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {[...categoryTotals.entries()].sort((a, b) => b[1] - a[1]).map(([category, total]) => (
                <tr key={category}>
                  <td className="capitalize">{category.replace(/_/g, " ")}</td>
                  <td className="text-right tabular-nums">{formatMoney(total, ctx.activeOrg.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      {ctx.permissions.includes("report.export") ? (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold">Export member data</h2>
            <p className="text-xs text-ink-500">CSV export is audited and excludes pastoral notes.</p>
          </div>
          <a
            href="/api/members/export"
            className="rounded-lg bg-ink-900 px-4 py-2 text-xs font-semibold text-white hover:bg-ink-800"
          >
            Download CSV
          </a>
        </Card>
      ) : null}
    </div>
  );
}
