import { CalendarDays, MapPin } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, SectionHeader } from "@/components/ui";
import { EventForm } from "@/components/event-form";
import { SubmitButton } from "@/components/submit-button";
import { cancelEvent } from "@/app/actions/events";
import { formatDateTime } from "@/lib/utils";
import type { BranchRow, EventRow } from "@/lib/types";

export const metadata = { title: "Events" };
export const dynamic = "force-dynamic";

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const ctx = await requirePermission("event.view");
  const { view } = await searchParams;
  const supabase = await createClient();

  const [{ data: branches }, { data: events }] = await Promise.all([
    supabase.from("branches").select("id, name").eq("organization_id", ctx.activeOrg.id).order("name"),
    supabase
      .from("events")
      .select("id, title, description, type, status, start_time, end_time, timezone, location, branch_id, capacity, organizer_id")
      .eq("organization_id", ctx.activeOrg.id)
      .order("start_time", { ascending: view !== "past" })
      .limit(60),
  ]);

  const now = Date.now();
  const list = ((events ?? []) as EventRow[]).filter((event) =>
    view === "past" ? new Date(event.start_time).getTime() < now : new Date(event.end_time).getTime() >= now,
  );
  const canManage = ctx.permissions.includes("event.manage");

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Events & calendar"
        description="Services, prayer meetings, outreach and department gatherings across every branch."
        action={canManage ? <EventForm branches={(branches ?? []) as BranchRow[]} timezone={ctx.activeOrg.timezone} /> : undefined}
      />

      <div className="flex gap-2 text-xs">
        <a
          href="/events"
          className={`rounded-full px-3 py-1.5 font-semibold ${view !== "past" ? "bg-ink-900 text-white" : "border border-ink-300 text-ink-600"}`}
        >
          Upcoming
        </a>
        <a
          href="/events?view=past"
          className={`rounded-full px-3 py-1.5 font-semibold ${view === "past" ? "bg-ink-900 text-white" : "border border-ink-300 text-ink-600"}`}
        >
          Past
        </a>
      </div>

      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarDays className="h-8 w-8" />}
            title={view === "past" ? "No past events" : "Nothing on the calendar"}
            description="Create a service, prayer meeting or outreach to start planning attendance and follow-up."
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((event) => (
            <Card key={event.id} className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-base font-semibold text-ink-900">{event.title}</h2>
                    <Badge tone={event.status === "scheduled" ? "success" : event.status === "cancelled" ? "danger" : "neutral"}>
                      {event.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs font-medium text-royal-700">{formatDateTime(event.start_time, ctx.activeOrg.timezone)}</p>
                  <p className="text-xs text-ink-500">
                    until {formatDateTime(event.end_time, ctx.activeOrg.timezone)}
                  </p>
                </div>
                <Badge tone="info">{event.type}</Badge>
              </div>
              {event.description ? <p className="line-clamp-2 text-sm text-ink-600">{event.description}</p> : null}
              <div className="mt-auto flex flex-wrap items-center gap-3 text-xs text-ink-500">
                {event.location ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" aria-hidden /> {event.location}
                  </span>
                ) : null}
                {event.capacity ? <span>Capacity {event.capacity}</span> : null}
                <span>
                  {(branches as BranchRow[] | null)?.find((b) => b.id === event.branch_id)?.name ?? "Organization-wide"}
                </span>
                {canManage && event.status === "scheduled" ? (
                  <form action={cancelEvent} className="ml-auto">
                    <input type="hidden" name="id" value={event.id} />
                    <SubmitButton size="sm" variant="ghost" pendingLabel="Cancelling…">
                      Cancel event
                    </SubmitButton>
                  </form>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
