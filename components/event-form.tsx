"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { saveEvent } from "@/app/actions/events";

type Option = { id: string; name: string };

export function EventForm({ branches, timezone }: { branches: Option[]; timezone: string }) {
  const [state, action] = useActionState(saveEvent, null);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        New event
      </Button>
    );
  }

  return (
    <form action={action} className="w-full space-y-4">
      {state?.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" htmlFor="title" required error={state?.fieldErrors?.title}>
          <Input id="title" name="title" required placeholder="Sunday Celebration Service" />
        </Field>
        <Field label="Type" htmlFor="type" required>
          <Select id="type" name="type" defaultValue="service">
            <option value="service">Church service</option>
            <option value="prayer">Prayer meeting</option>
            <option value="fellowship">Fellowship</option>
            <option value="conference">Conference</option>
            <option value="outreach">Outreach</option>
            <option value="department">Department meeting</option>
            <option value="counselling">Counselling appointment</option>
            <option value="other">Other</option>
          </Select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts" htmlFor="start_time" required error={state?.fieldErrors?.start_time}>
          <Input id="start_time" name="start_time" type="datetime-local" required />
        </Field>
        <Field
          label="Ends"
          htmlFor="end_time"
          required
          error={state?.fieldErrors?.end_time}
          hint={`Times are shown in ${timezone}`}
        >
          <Input id="end_time" name="end_time" type="datetime-local" required />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Location" htmlFor="location">
          <Input id="location" name="location" placeholder="Main auditorium" />
        </Field>
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
        <Field label="Capacity" htmlFor="capacity" hint="Optional">
          <Input id="capacity" name="capacity" type="number" min={1} />
        </Field>
      </div>
      <Field label="Description" htmlFor="description">
        <Textarea id="description" name="description" rows={3} />
      </Field>
      <div className="flex items-center gap-2">
        <SubmitButton pendingLabel="Saving…">Create event</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
