"use client";

import { useActionState } from "react";
import { Alert, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { createSession } from "@/app/actions/attendance";

type Option = { id: string; name: string };

export function SessionForm({ events = [], branches = [] }: { events?: Option[]; branches?: Option[] }) {
  const [state, action] = useActionState(createSession, null);
  const createdId = state?.ok ? state.fieldErrors?.id : undefined;

  return (
    <form action={action} className="space-y-3">
      {state?.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}
      {createdId ? (
        <a href={`/attendance/${createdId}`} className="block rounded-lg bg-ink-900 px-3 py-2 text-center text-xs font-semibold text-white">
          Open the new session →
        </a>
      ) : null}
      <Field label="Session title" htmlFor="title" required error={state?.fieldErrors?.title}>
        <Input id="title" name="title" placeholder="Sunday Celebration Service" required />
      </Field>
      <Field label="Date" htmlFor="session_date" required error={state?.fieldErrors?.session_date}>
        <Input id="session_date" name="session_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
      </Field>
      {events.length > 0 ? (
        <Field label="Linked event" htmlFor="event_id" hint="Optional">
          <Select id="event_id" name="event_id" defaultValue="">
            <option value="">Standalone session</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      {branches.length > 0 ? (
        <Field label="Branch" htmlFor="branch_id">
          <Select id="branch_id" name="branch_id" defaultValue="">
            <option value="">Organization-wide</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <SubmitButton className="w-full" pendingLabel="Creating…">
        Create session
      </SubmitButton>
    </form>
  );
}
