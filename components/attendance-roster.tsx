"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Clock, CloudOff, RefreshCw, Search, X } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { enqueue, flushQueue, readQueue } from "@/lib/offline";
import { syncAttendance } from "@/app/actions/attendance";
import { initials } from "@/lib/utils";

type Member = { id: string; first_name: string; last_name: string; branch_id: string | null };
type Status = "present" | "absent" | "excused";

export function AttendanceRoster({
  sessionId,
  members,
  initial,
  canManage,
  closed,
}: {
  sessionId: string;
  members: Member[];
  initial: Record<string, Status>;
  canManage: boolean;
  closed: boolean;
}) {
  const [statuses, setStatuses] = useState<Record<string, Status>>(initial);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);

  const refreshQueue = useCallback(async () => {
    const queue = await readQueue();
    setQueued(queue.filter((item) => item.sessionId === sessionId).length);
  }, [sessionId]);

  useEffect(() => {
    setOnline(navigator.onLine);
    void refreshQueue();
    const onOnline = () => {
      setOnline(true);
      void (async () => {
        const result = await flushQueue(syncAttendance);
        await refreshQueue();
        if (result.synced > 0) setFlash(`${result.synced} offline record(s) synced.`);
      })();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [refreshQueue]);

  const mark = async (memberId: string, status: Status) => {
    if (!canManage || closed) return;
    const previous = statuses[memberId];
    setStatuses((prev) => ({ ...prev, [memberId]: status }));
    setPending((prev) => new Set(prev).add(memberId));

    try {
      const result = await syncAttendance(sessionId, [
        {
          member_id: memberId,
          status,
          client_ref: `${sessionId}:${memberId}`,
        },
      ]);
      if (!result.ok) throw new Error(result.message ?? "sync failed");
      setFlash("Saved");
      setTimeout(() => setFlash(null), 1500);
    } catch {
      await enqueue({ sessionId, memberId, status });
      await refreshQueue();
      setFlash(navigator.onLine ? "Saved to this device — will retry." : "Offline — saved on this device.");
      setTimeout(() => setFlash(null), 2500);
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(memberId);
        return next;
      });
      if (previous) setStatuses((prev) => ({ ...prev, [memberId]: status }));
    }
  };

  const syncNow = async () => {
    const result = await flushQueue(syncAttendance);
    await refreshQueue();
    setFlash(
      result.synced > 0
        ? `${result.synced} record(s) synced.`
        : result.message ?? "Nothing left to sync.",
    );
    setTimeout(() => setFlash(null), 3000);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter(
      (m) =>
        !q ||
        `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
        m.last_name.toLowerCase().includes(q),
    );
  }, [members, query]);

  const present = Object.values(statuses).filter((s) => s === "present").length;
  const absent = Object.values(statuses).filter((s) => s === "absent").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          {present} present
        </span>
        <span className="rounded-full bg-ink-100 px-3 py-1 text-xs font-semibold text-ink-600">{absent} absent</span>
        <span className="text-xs text-ink-400">{members.length} on roll</span>
        <span className="ml-auto flex items-center gap-2">
          {!online ? (
            <Badge tone="warning">
              <CloudOff className="h-3 w-3" aria-hidden /> offline
            </Badge>
          ) : null}
          {queued > 0 ? (
            <Button size="sm" variant="secondary" onClick={syncNow}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Sync {queued}
            </Button>
          ) : null}
        </span>
      </div>

      {flash ? (
        <p className="rounded-lg bg-ink-900 px-3 py-2 text-xs font-medium text-white" role="status">
          {flash}
        </p>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the roll…"
          aria-label="Search members"
          className="kf-input pl-9"
        />
      </div>

      <ul className="divide-y divide-ink-100 overflow-hidden rounded-xl border border-ink-200 bg-white">
        {filtered.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-ink-500">No members match that search.</li>
        ) : (
          filtered.map((member) => {
            const status = statuses[member.id];
            const isPending = pending.has(member.id);
            return (
              <li key={member.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink-100 text-[11px] font-bold text-ink-600">
                  {initials(member.first_name, member.last_name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink-800">
                    {member.first_name} {member.last_name}
                  </span>
                  {isPending ? (
                    <span className="flex items-center gap-1 text-[10px] text-ink-400">
                      <Clock className="h-2.5 w-2.5" aria-hidden /> saving…
                    </span>
                  ) : null}
                </span>
                {status ? (
                  <Badge tone={status === "present" ? "success" : status === "excused" ? "info" : "neutral"}>
                    {status}
                  </Badge>
                ) : null}
                {canManage && !closed ? (
                  <span className="flex shrink-0 gap-1">
                    <button
                      onClick={() => mark(member.id, "present")}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      aria-label={`Mark ${member.first_name} ${member.last_name} present`}
                    >
                      <Check className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      onClick={() => mark(member.id, "absent")}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-ink-200 text-ink-500 hover:bg-ink-50"
                      aria-label={`Mark ${member.first_name} ${member.last_name} absent`}
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </span>
                ) : null}
              </li>
            );
          })
        )}
      </ul>
      {closed ? (
        <p className="text-xs text-ink-400">Check-in is closed for this session. Reopen it to keep marking.</p>
      ) : null}
    </div>
  );
}
