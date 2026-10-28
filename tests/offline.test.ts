import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, unknown>();

vi.mock("idb-keyval", () => ({
  get: async (key: string) => store.get(key),
  set: async (key: string, value: unknown) => {
    store.set(key, value);
  },
}));

const { enqueue, flushQueue, readQueue, writeQueue } = await import("@/lib/offline");

describe("offline attendance queue", () => {
  beforeEach(() => {
    store.clear();
  });

  it("queues one entry per member and replaces an earlier mark", async () => {
    await enqueue({ sessionId: "s1", memberId: "m1", status: "present" });
    await enqueue({ sessionId: "s1", memberId: "m2", status: "present" });
    expect(await readQueue()).toHaveLength(2);

    await enqueue({ sessionId: "s1", memberId: "m1", status: "absent" });
    const queue = await readQueue();
    expect(queue).toHaveLength(2);
    expect(queue.find((q) => q.memberId === "m1")?.status).toBe("absent");
  });

  it("empties the queue only for records the server confirmed", async () => {
    await enqueue({ sessionId: "s1", memberId: "m1", status: "present" });
    await enqueue({ sessionId: "s2", memberId: "m2", status: "present" });

    const send = vi.fn(async (sessionId: string) =>
      sessionId === "s1" ? { ok: true } : { ok: false, message: "Server rejected" },
    );

    const result = await flushQueue(send);
    expect(result.synced).toBe(1);
    expect(result.remaining).toBe(1);
    expect(result.message).toBe("Server rejected");

    const left = await readQueue();
    expect(left).toHaveLength(1);
    expect(left[0]!.sessionId).toBe("s2");
  });

  it("keeps everything when the network throws", async () => {
    await enqueue({ sessionId: "s1", memberId: "m1", status: "present" });
    const result = await flushQueue(async () => {
      throw new Error("offline");
    });
    expect(result.synced).toBe(0);
    expect(result.remaining).toBe(1);
    expect(result.message).toMatch(/offline/i);
    expect(await readQueue()).toHaveLength(1);
  });

  it("retries are idempotent because client_ref travels with each record", async () => {
    await enqueue({ sessionId: "s1", memberId: "m1", status: "present" });
    const first = await readQueue();
    const captured: string[] = [];
    await flushQueue(async (_sessionId, items) => {
      captured.push(...items.map((i) => i.client_ref));
      return { ok: true };
    });
    expect(captured).toEqual([first[0]!.id]);
    expect(await readQueue()).toHaveLength(0);
  });

  it("is a no-op when the queue is empty", async () => {
    const send = vi.fn(async () => ({ ok: true }));
    const result = await flushQueue(send);
    expect(result).toEqual({ synced: 0, failed: 0, remaining: 0 });
    expect(send).not.toHaveBeenCalled();
  });

  it("survives a corrupt queue value instead of crashing the page", async () => {
    store.set("kf.attendance.queue.v1", "not-an-array");
    expect(await readQueue()).toEqual([]);
    await writeQueue([]);
    expect(await readQueue()).toEqual([]);
  });
});
