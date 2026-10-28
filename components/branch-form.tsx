"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { saveBranch } from "@/app/actions/structure";

export function BranchForm() {
  const [state, action] = useActionState(saveBranch, null);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        New branch
      </Button>
    );
  }

  return (
    <form action={action} className="w-full space-y-4">
      {state?.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Branch name" htmlFor="name" required error={state?.fieldErrors?.name}>
          <Input id="name" name="name" required placeholder="Cape Coast Central" />
        </Field>
        <Field label="City" htmlFor="city">
          <Input id="city" name="city" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone" htmlFor="phone">
          <Input id="phone" name="phone" type="tel" />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" />
        </Field>
      </div>
      <Field label="Address" htmlFor="address">
        <Input id="address" name="address" />
      </Field>
      <Field label="Status" htmlFor="status">
        <Select id="status" name="status" defaultValue="active">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </Field>
      <div className="flex gap-2">
        <SubmitButton pendingLabel="Saving…">Create branch</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
