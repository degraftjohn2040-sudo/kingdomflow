import { describe, expect, it } from "vitest";
import {
  contributionSchema,
  eventSchema,
  inviteSchema,
  memberSchema,
  onboardingSchema,
  zodFieldErrors,
} from "@/lib/validation";

describe("memberSchema", () => {
  it("accepts a minimal member and defaults the status", () => {
    const parsed = memberSchema.parse({ first_name: " Ama ", last_name: "Mensah" });
    expect(parsed.first_name).toBe("Ama");
    expect(parsed.status).toBe("active");
  });

  it("rejects an empty name and an invalid email", () => {
    const result = memberSchema.safeParse({ first_name: "  ", last_name: "Mensah", email: "not-an-email" });
    expect(result.success).toBe(false);
    const errors = zodFieldErrors(result.error!);
    expect(errors.first_name).toBeTruthy();
    expect(errors.email).toBeTruthy();
  });

  it("accepts an empty optional email but rejects a malformed date", () => {
    expect(memberSchema.safeParse({ first_name: "A", last_name: "B", email: "" }).success).toBe(true);
    expect(memberSchema.safeParse({ first_name: "A", last_name: "B", date_of_birth: "31/02/1990" }).success).toBe(false);
  });
});

describe("eventSchema", () => {
  const base = {
    title: "Sunday Service",
    type: "service",
    start_time: "2026-11-01T09:00",
    end_time: "2026-11-01T11:00",
    timezone: "Africa/Accra",
  };

  it("accepts a valid event", () => {
    expect(eventSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an event that ends before it starts", () => {
    const result = eventSchema.safeParse({ ...base, end_time: "2026-11-01T08:00" });
    expect(result.success).toBe(false);
  });
});

describe("onboardingSchema", () => {
  it("requires a name, a real timezone and at most 20 departments", () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => `Dept ${i}`);
    const result = onboardingSchema.safeParse({
      name: "Grace Chapel",
      timezone: "Mars/Olympus",
      departments: tooMany,
    });
    expect(result.success).toBe(false);
  });
});

describe("inviteSchema", () => {
  it("cannot invite someone as owner", () => {
    expect(inviteSchema.safeParse({ email: "a@b.com", role: "owner" }).success).toBe(false);
    expect(inviteSchema.safeParse({ email: "a@b.com", role: "viewer" }).success).toBe(true);
  });
});

describe("contributionSchema", () => {
  it("rejects zero and negative amounts", () => {
    const payload = { amount: "0", category: "offering", given_at: "2026-10-28" };
    expect(contributionSchema.safeParse(payload).success).toBe(false);
    expect(contributionSchema.safeParse({ ...payload, amount: "-5" }).success).toBe(false);
    expect(contributionSchema.safeParse({ ...payload, amount: "50.5" }).success).toBe(true);
  });
});
