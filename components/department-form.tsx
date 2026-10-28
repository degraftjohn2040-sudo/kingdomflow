"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { saveDepartment } from "@/app/actions/structure";

type Option = { id: string; name: string };

export function DepartmentForm({ branches, members }: { branches: Option[]; members: Option[] }) {
  const [state, action] = useActionState(saveDepartment, null);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        New department
      </Button>
    );
  }

  return (
    <form action={action} className="w-full space-y-4">
      {state?.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" required error={state?.fieldErrors?.name}>
          <Input id="name" name="name" required placeholder="Choir" />
        </Field>
        <Field label="Type" htmlFor="type">
          <Select id="type" name="type" defaultValue="department">
            <option value="department">Department</option>
            <option value="fellowship">Fellowship group</option>
            <option value="choir">Choir / worship</option>
            <option value="outreach">Outreach team</option>
            <option value="followup">Follow-up team</option>
            <option value="prayer">Prayer group</option>
            <option value="other">Other</option>
          </Select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
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
        <Field label="Leader" htmlFor="leader_id" hint="Optional">
          <Select id="leader_id" name="leader_id" defaultValue="">
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Description" htmlFor="description">
        <Textarea id="description" name="description" rows={2} />
      </Field>
      <div className="flex gap-2">
        <SubmitButton pendingLabel="Saving…">Create department</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
