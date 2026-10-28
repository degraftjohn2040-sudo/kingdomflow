import { describe, expect, it } from "vitest";
import { findDuplicateKeys, guessColumnMapping, parseCsv, toCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("parses a simple file and trims the header", () => {
    const { headers, rows } = parseCsv("First Name,Last Name\nAma,Mensah\n");
    expect(headers).toEqual(["First Name", "Last Name"]);
    expect(rows).toEqual([{ "First Name": "Ama", "Last Name": "Mensah" }]);
  });

  it("handles quoted values containing commas, quotes and newlines", () => {
    const csv = 'name,notes\n"Mensah, Ama","She said ""hello""\nand left"';
    const { rows } = parseCsv(csv);
    expect(rows[0]!.name).toBe("Mensah, Ama");
    expect(rows[0]!.notes).toBe('She said "hello"\nand left');
  });

  it("ignores blank trailing lines", () => {
    const { rows } = parseCsv("a,b\n1,2\n\n\n");
    expect(rows).toHaveLength(1);
  });
});

describe("toCsv", () => {
  it("escapes separators, quotes and newlines", () => {
    const csv = toCsv([{ name: 'Ama "A"', note: "a,b\nc" }], ["name", "note"]);
    expect(csv.split("\r\n")[0]).toBe("name,note");
    expect(csv).toContain('"Ama ""A"""');
    expect(csv).toContain('"a,b\nc"');
  });

  it("keeps a stable column order and renders nulls as empty", () => {
    const csv = toCsv([{ b: 2, a: null }], ["a", "b"]);
    expect(csv).toBe("a,b\r\n,2");
  });
});

describe("guessColumnMapping", () => {
  const FIELDS = ["first_name", "last_name", "email", "phone", "city", "joined_on"];

  it("maps messy real-world headers", () => {
    const mapping = guessColumnMapping(["First Name", "SURNAME", "Mobile Phone", "E-mail", "Town"], FIELDS);
    expect(mapping["First Name"]).toBe("first_name");
    expect(mapping.SURNAME).toBe("last_name");
    expect(mapping["Mobile Phone"]).toBe("phone");
    expect(mapping["E-mail"]).toBe("email");
    expect(mapping.Town).toBe("city");
  });

  it("never maps a header onto a field that does not exist", () => {
    const mapping = guessColumnMapping(["National ID"], FIELDS);
    expect(Object.values(mapping).every((field) => FIELDS.includes(field))).toBe(true);
  });
});

describe("findDuplicateKeys", () => {
  const row = (first_name: string, last_name: string, email?: string, phone?: string) => ({
    first_name,
    last_name,
    email: email ?? null,
    phone: phone ?? null,
  });

  it("flags repeated emails regardless of case", () => {
    expect(findDuplicateKeys([row("Ama", "Mensah", "AMA@example.com"), row("Ama", "Mensah", "ama@example.com")])).toEqual([1]);
  });

  it("flags repeated phone numbers written in different formats", () => {
    const rows = [row("Kojo", "Owusu", undefined, "+233 24 000 0001"), row("Kofi", "Owusu", undefined, "233240000001")];
    expect(findDuplicateKeys(rows)).toEqual([1]);
  });

  it("falls back to name matching only when no contact details exist", () => {
    const rows = [row("Yaa", "Asantewaa"), row("Yaa", "Asantewaa")];
    expect(findDuplicateKeys(rows)).toEqual([1]);
  });

  it("does not flag same-named people who have different emails", () => {
    const rows = [row("John", "Mensah", "j1@example.com"), row("John", "Mensah", "j2@example.com")];
    expect(findDuplicateKeys(rows)).toEqual([]);
  });
});
