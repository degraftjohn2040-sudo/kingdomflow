/** Minimal, dependency-free RFC4180 CSV writer/parser used for member import and export. */

export function toCsv(rows: Array<Record<string, unknown>>, columns?: string[]): string {
  if (rows.length === 0) return "";
  const cols = columns ?? Object.keys(rows[0] ?? {});
  const escape = (value: unknown) => {
    const s = value === null || value === undefined ? "" : String(value);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((row) => cols.map((c) => escape(row[c])).join(","))].join("\r\n");
}

export function parseCsv(input: string): { headers: string[]; rows: Record<string, string>[] } {
  const text = input.replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      record.push(field);
      field = "";
    } else if (char === "\n") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else if (char === "\r") {
      // handled by \n
    } else {
      field += char;
    }
  }
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  const nonEmpty = records.filter((r) => r.some((c) => c.trim() !== ""));
  const [rawHeaders = [], ...body] = nonEmpty;
  const headers = rawHeaders.map((h) => h.trim());
  const rows = body.map((cells) => {
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = (cells[index] ?? "").trim();
    });
    return row;
  });
  return { headers, rows };
}

/** Common spreadsheet header synonyms mapped onto canonical member fields. */
const SYNONYMS: Record<string, string> = {
  surname: "last_name",
  familyname: "last_name",
  othername: "last_name",
  firstname: "first_name",
  givenname: "first_name",
  forename: "first_name",
  mobile: "phone",
  mobilephone: "phone",
  phonenumber: "phone",
  tel: "phone",
  telephone: "phone",
  whatsapp: "phone",
  mail: "email",
  emailaddress: "email",
  town: "city",
  location: "city",
  joined: "joined_on",
  datejoined: "joined_on",
  membershipdate: "joined_on",
  sex: "gender",
};

/** Fuzzy header matching so "First Name", "first_name" and "FIRSTNAME" all map to first_name. */
export function guessColumnMapping(headers: string[], fields: string[]): Record<string, string> {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const mapping: Record<string, string> = {};
  for (const header of headers) {
    const h = normalize(header);
    const synonym = SYNONYMS[h];
    if (synonym && fields.includes(synonym)) {
      mapping[header] = synonym;
      continue;
    }
    const exact = fields.find((f) => normalize(f) === h);
    if (exact) {
      mapping[header] = exact;
      continue;
    }
    const partial = fields.find((f) => normalize(f).includes(h) || h.includes(normalize(f)));
    if (partial && h.length > 2) mapping[header] = partial;
  }
  return mapping;
}

export function findDuplicateKeys(
  rows: Array<{ email?: string | null; phone?: string | null; first_name: string; last_name: string }>,
): number[] {
  const seen = new Map<string, number>();
  const duplicates: number[] = [];
  rows.forEach((row, index) => {
    const email = row.email?.trim().toLowerCase();
    const phone = row.phone?.replace(/[^0-9]/g, "");
    const name = `${row.first_name.trim().toLowerCase()}|${row.last_name.trim().toLowerCase()}`;
    const keys = [email ? `e:${email}` : null, phone && phone.length >= 7 ? `p:${phone}` : null].filter(
      Boolean,
    ) as string[];
    let dup = false;
    for (const key of keys) {
      if (seen.has(key)) dup = true;
      else seen.set(key, index);
    }
    if (keys.length === 0) {
      if (seen.has(`n:${name}`)) dup = true;
      else seen.set(`n:${name}`, index);
    }
    if (dup) duplicates.push(index);
  });
  return duplicates;
}
