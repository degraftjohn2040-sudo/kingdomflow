"use client";

import { useActionState, useMemo, useState } from "react";
import { Alert, Button, Card, Field, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { importMembers } from "@/app/actions/members";
import { findDuplicateKeys, guessColumnMapping, parseCsv } from "@/lib/csv";
import type { BranchRow } from "@/lib/types";

const FIELDS = ["first_name", "last_name", "email", "phone", "gender", "city", "joined_on"];

export function MemberImport({ branches }: { branches: BranchRow[] }) {
  const [state, action] = useActionState(importMembers, null);
  const [raw, setRaw] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});

  const parsed = useMemo(() => (raw.trim() ? parseCsv(raw) : null), [raw]);

  const mapped = useMemo(() => {
    if (!parsed) return [];
    return parsed.rows.map((row) => {
      const out: Record<string, string> = {};
      for (const [header, field] of Object.entries(mapping)) {
        if (field) out[field] = row[header] ?? "";
      }
      return out;
    });
  }, [parsed, mapping]);

  const invalidRows = mapped
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !row.first_name || !row.last_name);
  const duplicates = findDuplicateKeys(
    mapped.map((row) => ({
      first_name: row.first_name ?? "",
      last_name: row.last_name ?? "",
      email: row.email,
      phone: row.phone,
    })),
  );

  return (
    <div className="space-y-5">
      <Card>
        <h2 className="font-display text-lg font-semibold">1. Choose your CSV</h2>
        <p className="mt-1 text-xs text-ink-500">
          The first row must be a header row. Recognised columns: {FIELDS.join(", ")}. Nothing is uploaded until you
          review and confirm.
        </p>
        <div className="mt-4 space-y-3">
          <input
            type="file"
            accept=".csv,text/csv"
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-ink-900 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              setRaw(text);
              const { headers } = parseCsv(text);
              setMapping(guessColumnMapping(headers, FIELDS));
            }}
          />
          <details className="text-xs text-ink-500">
            <summary className="cursor-pointer font-semibold text-royal-700">Or paste CSV data</summary>
            <textarea
              className="kf-input mt-2 min-h-[140px] font-mono text-xs"
              placeholder="first_name,last_name,email,phone&#10;Ama,Mensah,ama@example.com,+233200000000"
              onChange={(event) => {
                setRaw(event.target.value);
                if (event.target.value.trim()) {
                  const { headers } = parseCsv(event.target.value);
                  setMapping(guessColumnMapping(headers, FIELDS));
                }
              }}
            />
          </details>
        </div>
      </Card>

      {parsed ? (
        <Card>
          <h2 className="font-display text-lg font-semibold">2. Map columns</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {parsed.headers.map((header) => (
              <Field key={header} label={header || "(unnamed column)"} htmlFor={`map-${header}`}>
                <Select
                  id={`map-${header}`}
                  value={mapping[header] ?? ""}
                  onChange={(event) => setMapping((prev) => ({ ...prev, [header]: event.target.value }))}
                >
                  <option value="">Ignore this column</option>
                  {FIELDS.map((field) => (
                    <option key={field} value={field}>
                      {field}
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
          </div>
        </Card>
      ) : null}

      {parsed ? (
        <Card>
          <h2 className="font-display text-lg font-semibold">3. Review & import</h2>
          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            <span className="rounded-full bg-ink-100 px-2.5 py-1 font-semibold text-ink-700">
              {mapped.length} row(s) found
            </span>
            {invalidRows.length > 0 ? (
              <span className="rounded-full bg-red-50 px-2.5 py-1 font-semibold text-red-700">
                {invalidRows.length} missing a name
              </span>
            ) : null}
            {duplicates.length > 0 ? (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">
                {duplicates.length} possible duplicate(s)
              </span>
            ) : null}
          </div>

          <div className="mt-4 max-h-64 overflow-auto rounded-lg border border-ink-200">
            <table className="kf-table text-xs">
              <thead>
                <tr>
                  <th>#</th>
                  <th>First</th>
                  <th>Last</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Flag</th>
                </tr>
              </thead>
              <tbody>
                {mapped.slice(0, 50).map((row, index) => (
                  <tr key={index}>
                    <td className="text-ink-400">{index + 1}</td>
                    <td>{row.first_name || "—"}</td>
                    <td>{row.last_name || "—"}</td>
                    <td>{row.email || "—"}</td>
                    <td>{row.phone || "—"}</td>
                    <td>
                      {!row.first_name || !row.last_name ? (
                        <span className="text-red-600">Missing name</span>
                      ) : duplicates.includes(index) ? (
                        <span className="text-amber-700">Possible duplicate</span>
                      ) : (
                        <span className="text-emerald-700">Ready</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {mapped.length > 50 ? <p className="mt-2 text-xs text-ink-400">Showing the first 50 rows.</p> : null}

          <form action={action} className="mt-4 space-y-3">
            {state?.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}
            <input type="hidden" name="payload" value={JSON.stringify(mapped)} />
            <Field label="Default branch for this import" htmlFor="branch_id">
              <Select id="branch_id" name="branch_id" defaultValue="">
                <option value="">Organization-wide</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-center gap-2">
              <SubmitButton disabled={invalidRows.length > 0 || mapped.length === 0} pendingLabel="Importing…">
                Import {mapped.length} member(s)
              </SubmitButton>
              {invalidRows.length > 0 ? (
                <span className="text-xs text-red-600">Fix rows missing a name before importing.</span>
              ) : null}
              <Button type="button" variant="ghost" size="sm" onClick={() => setRaw("")}>
                Clear
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
