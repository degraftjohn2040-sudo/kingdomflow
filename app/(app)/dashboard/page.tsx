import Link from "next/link";
import {
  ArrowUpRight, CalendarDays, ClipboardCheck, HandCoins, UserPlus, UserRoundCheck, Users,
} from "lucide-react";
import { requireWorkspace } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, ButtonLink, Card, EmptyState, SectionHeader, Stat } from "@/components/ui";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/utils";
import type { WorkspaceSummary } from "@/lib/types";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await requireWorkspace();
  const supabase = await createClient();

  const [{ data: summaryRaw }, { data: events }, { data: recentMembers }] = await Promise.all([
    supabase.rpc("workspace_summary", { target_org: ctx.activeOrg.id }),
    supabase
      .from("events")
      .select("id, title, start_time, type, location")
      .eq("organization_id", ctx.activeOrg.id)
      .eq("status", "scheduled")
      .gte("start_time", new Date().toISOString())
      .order("start_time")
      .limit(4),
    supabase
      .from("members")
      .select("id, first_name, last_name, status, created_at")
      .eq("organization_id", ctx.activeOrg.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const summary = (summaryRaw ?? null) as WorkspaceSummary | null;
  const trend = summary?.attendance_trend ?? [];
  const peak = Math.max(1, ...trend.map((point) => point.present));

  return (
    <div className="space-y-6">
      <SectionHeader
        title={`Good to see you, ${ctx.user.fullName.split(" ")[0]}`}
        description={`${ctx.activeOrg.name} · ${ctx.role?.replace(/_/g, " ")} · ${ctx.activeOrg.timezone}`}
        action={
          <div className="flex flex-wrap gap-2">
            {ctx.permissions.includes("member.create") ? (
              <ButtonLink href="/members/new" size="sm">
                <UserPlus className="h-4 w-4" aria-hidden /> Add member
              </ButtonLink>
            ) : null}
            {ctx.permissions.includes("attendance.manage") ? (
              <ButtonLink href="/attendance" size="sm" variant="secondary">
                <ClipboardCheck className="h-4 w-4" aria-hidden /> Take attendance
              </ButtonLink>
            ) : null}
          </div>
        }
      />

      {!summary ? (
        <Card>
          <EmptyState
            title="We could not load your summary"
            description="Your permissions may have changed. Refresh the page or contact an administrator."
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Members" value={formatNumber(summary.members_total)} hint={`${summary.members_new} added in 30 days`} />
            <Stat label="Team" value={formatNumber(summary.team)} hint={`${summary.branches} branch(es)`} />
            <Stat
              label="Attendance (30d)"
              value={formatNumber(summary.attendance_present)}
              hint={`${summary.sessions} session(s)`}
            />
            <Stat label="Visitors (30d)" value={formatNumber(summary.visitors)} hint={`${summary.open_followups} open follow-ups`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">Attendance trend</h2>
                <span className="text-[11px] uppercase tracking-wider text-ink-400">last 30 days</span>
              </div>
              {trend.length === 0 ? (
                <EmptyState
                  icon={<ClipboardCheck className="h-7 w-7" />}
                  title="No sessions yet"
                  description="Create an attendance session for your next service to start building the trend."
                  action={
                    ctx.permissions.includes("attendance.manage") ? (
                      <ButtonLink href="/attendance" size="sm" variant="secondary">
                        Create a session
                      </ButtonLink>
                    ) : undefined
                  }
                />
              ) : (
                <div className="mt-6 flex h-40 items-end gap-1.5" role="img" aria-label="Attendance by session date">
                  {trend.map((point) => (
                    <div key={point.day} className="group flex flex-1 flex-col items-center justify-end gap-1">
                      <span className="text-[10px] font-medium text-ink-400 opacity-0 transition group-hover:opacity-100">
                        {point.present}
                      </span>
                      <div
                        className="w-full rounded-t bg-royal-600/85 transition group-hover:bg-royal-700"
                        style={{ height: `${Math.max(4, (point.present / peak) * 100)}%` }}
                        title={`${formatDate(point.day)}: ${point.present} present`}
                      />
                      <span className="text-[9px] text-ink-400">{new Date(point.day).getDate()}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">Upcoming</h2>
                <Link href="/events" className="text-xs font-semibold text-royal-700 hover:underline">
                  All events
                </Link>
              </div>
              {!events || events.length === 0 ? (
                <EmptyState
                  icon={<CalendarDays className="h-7 w-7" />}
                  title="Nothing scheduled"
                  description="Add a service, prayer meeting or outreach to your calendar."
                />
              ) : (
                <ul className="mt-4 space-y-3">
                  {events.map((event) => (
                    <li key={event.id} className="flex gap-3 border-b border-ink-100 pb-3 last:border-0 last:pb-0">
                      <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-royal-50 text-royal-800">
                        <span className="text-[10px] font-semibold uppercase">
                          {new Intl.DateTimeFormat("en", { month: "short", timeZone: ctx.activeOrg.timezone }).format(
                            new Date(event.start_time),
                          )}
                        </span>
                        <span className="text-sm font-bold leading-none">
                          {new Intl.DateTimeFormat("en", { day: "numeric", timeZone: ctx.activeOrg.timezone }).format(
                            new Date(event.start_time),
                          )}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-800">{event.title}</p>
                        <p className="text-xs text-ink-500">
                          {formatDateTime(event.start_time, ctx.activeOrg.timezone)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {summary.can_finance ? (
              <Card className="lg:col-span-2">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-semibold">Finance (30 days)</h2>
                  <Link href="/giving" className="text-xs font-semibold text-royal-700 hover:underline">
                    Open giving
                  </Link>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-ink-400">Contributions</dt>
                    <dd className="mt-1 text-xl font-semibold tabular-nums text-emerald-700">
                      {formatMoney(summary.contributions_total ?? 0, ctx.activeOrg.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-ink-400">Expenses</dt>
                    <dd className="mt-1 text-xl font-semibold tabular-nums text-red-700">
                      {formatMoney(summary.expenses_total ?? 0, ctx.activeOrg.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-ink-400">Net</dt>
                    <dd className="mt-1 text-xl font-semibold tabular-nums">
                      {formatMoney(
                        (summary.contributions_total ?? 0) - (summary.expenses_total ?? 0),
                        ctx.activeOrg.currency,
                      )}
                    </dd>
                  </div>
                </dl>
              </Card>
            ) : (
              <Card className="lg:col-span-2">
                <h2 className="font-display text-lg font-semibold">Ministry pulse</h2>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-ink-50 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-ink-400">Departments</p>
                    <p className="mt-1 text-lg font-semibold">{summary.departments}</p>
                  </div>
                  <div className="rounded-lg bg-ink-50 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-ink-400">Open tasks</p>
                    <p className="mt-1 text-lg font-semibold">{summary.open_tasks}</p>
                  </div>
                  <div className="rounded-lg bg-ink-50 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-ink-400">Upcoming</p>
                    <p className="mt-1 text-lg font-semibold">{summary.upcoming_events}</p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-ink-400">
                  Financial figures are hidden because your role does not include finance access.
                </p>
              </Card>
            )}

            <Card>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">Newest members</h2>
                <Link href="/members" className="text-xs font-semibold text-royal-700 hover:underline">
                  Directory
                </Link>
              </div>
              {!recentMembers || recentMembers.length === 0 ? (
                <EmptyState
                  icon={<Users className="h-7 w-7" />}
                  title="No members yet"
                  description="Add your first member record or import a CSV to get started."
                />
              ) : (
                <ul className="mt-4 space-y-2.5">
                  {recentMembers.map((member) => (
                    <li key={member.id} className="flex items-center justify-between gap-2">
                      <Link
                        href={`/members/${member.id}`}
                        className="truncate text-sm font-medium text-ink-700 hover:text-royal-700 hover:underline"
                      >
                        {member.first_name} {member.last_name}
                      </Link>
                      <Badge tone={member.status === "active" ? "success" : "neutral"}>{member.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 border-t border-ink-100 pt-3 text-xs">
                <Link href="/reports" className="inline-flex items-center gap-1 font-semibold text-royal-700 hover:underline">
                  View reports <ArrowUpRight className="h-3 w-3" aria-hidden />
                </Link>
              </div>
            </Card>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { href: "/visitors", label: "Record a visitor", icon: UserRoundCheck, perm: "visitor.manage" },
              { href: "/giving", label: "Record giving", icon: HandCoins, perm: "finance.manage" },
              { href: "/followups", label: "Follow-ups", icon: CalendarDays, perm: "followup.view" },
              { href: "/team", label: "Invite staff", icon: Users, perm: "staff.manage" },
            ]
              .filter((item) => ctx.permissions.includes(item.perm))
              .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="kf-card flex items-center gap-3 p-4 transition hover:border-royal-300 hover:shadow-md"
                >
                  <item.icon className="h-4 w-4 text-royal-700" aria-hidden />
                  <span className="text-sm font-semibold text-ink-700">{item.label}</span>
                </Link>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
