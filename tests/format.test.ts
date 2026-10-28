import { describe, expect, it } from "vitest";
import { formatDate, formatMoney, initials, slugify } from "@/lib/utils";

describe("formatting", () => {
  it("formats money in the organization currency", () => {
    expect(formatMoney(1234.5, "GHS")).toContain("1,234.50");
    expect(formatMoney(null, "GHS")).toContain("0.00");
  });

  it("renders dates in the requested timezone", () => {
    const accra = formatDate("2026-10-28T23:30:00Z", "Africa/Accra");
    expect(accra).toContain("2026");
    expect(formatDate(null)).toBe("—");
    expect(formatDate("not-a-date")).toBe("—");
  });

  it("derives initials safely", () => {
    expect(initials("ama", "mensah")).toBe("AM");
    expect(initials("", "")).toBe("?");
    expect(initials(null, null)).toBe("?");
  });

  it("slugifies names for stable identifiers", () => {
    expect(slugify("Grace Chapel Int'l!")).toBe("grace-chapel-int-l");
    expect(slugify("   ")).toBe("");
  });
});
