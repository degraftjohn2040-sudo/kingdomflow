"use client";

import { get, set } from "idb-keyval";

/** Durable queue for attendance captured without connectivity. */
export type QueuedAttendance = {
  id: string;
  sessionId: string;
  memberId: string;
  status: "present" | "absent" | "excused";
  queuedAt: number;
};

const KEY = "kf.attendance.queue.v1";

export async function readQueue(): Promise<QueuedAttendance[]> {
  try {
    return ((await get<QueuedAttendance[]>(KEY)) ?? []).sort((a, b) => a.queuedAt - b.queuedAt);
  } catch {
    return [];
  }
}

export async function writeQueue(items: QueuedAttendance[]) {
  await set(KEY, items);
}

export async function enqueue(item: Omit<QueuedAttendance, "id" | "queuedAt">) {
  const queue = await readQueue();
  const entry: QueuedAttendance = {
    ...item,
    id: `${item.sessionId}:${item.memberId}`,
    queuedAt: Date.now(),
  };
  // Replace an earlier unsent mark for the same member/session rather than duplicating it.
  await writeQueue([...queue.filter((existing) => existing.id !== entry.id), entry]);
  return entry;
}

export type Sender = (
  sessionId: string,
  items: Array<{ member_id: string; status: string; client_ref: string }>,
) => Promise<{ ok: boolean; message?: string }>;

export interface FlushResult {
  synced: number;
  failed: number;
  remaining: number;
  message?: string;
}

/**
 * Sends queued records grouped by session. Only confirmed records leave the queue, so a
 * dropped connection cannot silently lose attendance. Writes are keyed by client_ref,
 * which the database also enforces as unique per session — safe to retry.
 */
export async function flushQueue(send: Sender): Promise<FlushResult> {
  const queue = await readQueue();
  if (queue.length === 0) return { synced: 0, failed: 0, remaining: 0 };

  const bySession = new Map<string, QueuedAttendance[]>();
  for (const item of queue) {
    bySession.set(item.sessionId, [...(bySession.get(item.sessionId) ?? []), item]);
  }

  const remaining: QueuedAttendance[] = [];
  let synced = 0;
  let message: string | undefined;

  for (const [sessionId, items] of bySession) {
    try {
      const result = await send(
        sessionId,
        items.map((item) => ({
          member_id: item.memberId,
          status: item.status,
          client_ref: item.id,
        })),
      );
      if (result.ok) synced += items.length;
      else {
        remaining.push(...items);
        message = result.message;
      }
    } catch {
      remaining.push(...items);
      message = "Still offline — records are safe on this device.";
    }
  }

  await writeQueue(remaining);
  return { synced, failed: remaining.length, remaining: remaining.length, message };
}
