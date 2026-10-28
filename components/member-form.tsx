"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { createMember, updateMember } from "@/app/actions/members";
import type { MemberRow, BranchRow } from "@/lib/types";

const STATUSES = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "visitor", label: "Visitor" },
  { value: "transferred", label: "Transferred" },
];

export function MemberForm({
  member,
  branches,
  mode,
}: {
  member?: MemberRow;
  branches: BranchRow[];
  mode: "create" | "edit";
}) {
  const [state, action] = useActionState(mode === "create" ? createMember : updateMember, null);

  return (
    <form action={action} className="space-y-6">
      {member ? <input type="hidden" name="id" value={member.id} /> : null}
      {state?.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor="first_name" required error={state?.fieldErrors?.first_name}>
          <Input id="first_name" name="first_name" required defaultValue={member?.first_name} autoComplete="given-name" />
        </Field>
        <Field label="Last name" htmlFor="last_name" required error={state?.fieldErrors?.last_name}>
          <Input id="last_name" name="last_name" required defaultValue={member?.last_name} autoComplete="family-name" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" htmlFor="email" error={state?.fieldErrors?.email}>
          <Input id="email" name="email" type="email" defaultValue={member?.email ?? ""} autoComplete="email" />
        </Field>
        <Field label="Phone" htmlFor="phone" error={state?.fieldErrors?.phone}>
          <Input id="phone" name="phone" type="tel" defaultValue={member?.phone ?? ""} autoComplete="tel" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Branch" htmlFor="branch_id">
          <Select id="branch_id" name="branch_id" defaultValue={member?.branch_id ?? ""}>
            <option value="">Organization-wide</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Membership status" htmlFor="status">
          <Select id="status" name="status" defaultValue={member?.status ?? "active"}>
            {STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Gender" htmlFor="gender">
          <Select id="gender" name="gender" defaultValue={member?.gender ?? ""}>
            <option value="">Not stated</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Marital status" htmlFor="marital_status">
          <Select id="marital_status" name="marital_status" defaultValue={member?.marital_status ?? ""}>
            <option value="">Not stated</option>
            <option value="single">Single</option>
            <option value="married">Married</option>
            <option value="widowed">Widowed</option>
            <option value="divorced">Divorced</option>
          </Select>
        </Field>
        <Field label="Date of birth" htmlFor="date_of_birth">
          <Input id="date_of_birth" name="date_of_birth" type="date" defaultValue={member?.date_of_birth ?? ""} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Joined on" htmlFor="joined_on">
          <Input
            id="joined_on"
            name="joined_on"
            type="date"
            defaultValue={member?.joined_on ?? member?.join_date ?? ""}
          />
        </Field>
        <Field label="City / town" htmlFor="city">
          <Input id="city" name="city" defaultValue={member?.city ?? ""} />
        </Field>
      </div>

      <Field label="Address" htmlFor="address">
        <Textarea id="address" name="address" defaultValue={member?.address ?? ""} rows={2} />
      </Field>

      <div className="rounded-lg bg-ink-50 p-3 text-xs leading-relaxed text-ink-500">
        Pastoral and care notes are stored separately with restricted access. A member record is not a login
        account — staff accounts are created through invitations.
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel={mode === "create" ? "Adding…" : "Saving…"}>
          {mode === "create" ? "Add member" : "Save changes"}
        </SubmitButton>
        <Link
          href={member ? `/members/${member.id}` : "/members"}
          className="text-sm font-semibold text-ink-500 hover:underline"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
