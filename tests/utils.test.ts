import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatMoney, formatNumber, initials, slugify } from "@/lib/utils";

describe("formatMoney", () => {
  it("formats Ghana cedis with two decimals", () => {
    expect(formatMoney(1234.5, "GHS")).toContain("1,234.50");
  });

  it("treats missing amounts as zero rather than NaN", () => {
    expect(formatMoney(null)).toContain("0.00");
    expect(formatMoney(undefined)).not.toContain("NaN");
  });
});

describe("formatNumber", () => {
  it("groups thousands", () => {
    expect(formatNumber(12345)).toBe("12,345");
  });
});

describe("formatDate", () => {
  it("returns an em dash for empty input", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDateTime(undefined)).toBe("—");
  });

  it("renders the date in the workspace timezone", () => {
    expect(formatDate("2026-10-28T23:30:00Z", "Africa/Accra")).toMatch(/2026/);
  });
});

describe("slugify", () => {
  it("produces url-safe slugs", () => {
    expect(slugify("Grace Chapel — Cape Coast!")).toBe("grace-chapel-cape-coast");
  });
});

describe("initials", () => {
  it("uses the first letters of both names", () => {
    expect(initials("Ama", "Mensah")).toBe("AM");
    expect(initials("Ama", null)).toBe("A");
  });
});
