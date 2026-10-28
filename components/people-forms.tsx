"use client";

import { useActionState } from "react";
import { createFollowup, createVisitor, setVisitorFollowup } from "@/app/actions/people";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";

type Option = { id: string; name: string };

export function VisitorForm({ branches, today }: { branches: Option[]; today: string }) {
  const [state, action, pending] = useActionState(createVisitor, null);

  return (
    <form action={action} className="space-y-3">
      {state?.message ? (
        <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="First name" htmlFor="first_name" error={state?.fieldErrors?.first_name}>
          <Input id="first_name" name="first_name" required autoComplete="off" />
        </Field>
        <Field label="Last name" htmlFor="last_name" error={state?.fieldErrors?.last_name}>
          <Input id="last_name" name="last_name" required autoComplete="off" />
        </Field>
        <Field label="Phone" htmlFor="phone" error={state?.fieldErrors?.phone}>
          <Input id="phone" name="phone" inputMode="tel" placeholder="+233…" />
        </Field>
        <Field label="Email" htmlFor="email" error={state?.fieldErrors?.email}>
          <Input id="email" name="email" type="email" autoComplete="off" />
        </Field>
        <Field label="First visit" htmlFor="visit_date" error={state?.fieldErrors?.visit_date}>
          <Input id="visit_date" name="visit_date" type="date" defaultValue={today} required />
        </Field>
        <Field label="Branch" htmlFor="branch_id">
          <Select id="branch_id" name="branch_id" defaultValue="">
            <option value="">Organization-wide</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Invited by" htmlFor="invited_by">
          <Input id="invited_by" name="invited_by" placeholder="Member or friend" />
        </Field>
        <Field label="How did they hear about us?" htmlFor="how_heard">
          <Input id="how_heard" name="how_heard" placeholder="Friend, flyer, radio…" />
        </Field>
      </div>

      <label className="flex items-start gap-2 text-xs text-ink-600">
        <input type="checkbox" name="consent_given" defaultChecked className="mt-0.5 h-4 w-4" />
        <span>The visitor agreed to be contacted by the church.</span>
      </label>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Record visitor"}
      </Button>
    </form>
  );
}

export function VisitorFollowupControl({ id, status }: { id: string; status: string }) {
  return (
    <form action={setVisitorFollowup} className="flex items-center gap-1">
      <input type="hidden" name="id" value={id} />
      <Select name="followup_status" defaultValue={status} className="h-8 py-0 text-xs">
        <option value="new">New</option>
        <option value="contacted">Contacted</option>
        <option value="scheduled">Visit scheduled</option>
        <option value="converted">Converted</option>
        <option value="closed">Closed</option>
      </Select>
      <Button type="submit" size="sm" variant="secondary">
        Save
      </Button>
    </form>
  );
}

export function FollowupForm({ members, staff }: { members: Option[]; staff: Option[] }) {
  const [state, action, pending] = useActionState(createFollowup, null);

  return (
    <form action={action} className="space-y-3">
      {state?.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}

      <Field label="What needs to happen?" htmlFor="title" error={state?.fieldErrors?.title}>
        <Input id="title" name="title" required placeholder="Call Mama Ama about hospital visit" />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type" htmlFor="type">
          <Select id="type" name="type" defaultValue="member">
            <option value="visitor">Visitor</option>
            <option value="member">Member</option>
            <option value="pastoral">Pastoral care</option>
            <option value="prayer">Prayer</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Priority" htmlFor="priority">
          <Select id="priority" name="priority" defaultValue="medium">
            <option value="low">Low</option>
            <option value="medium">Normal</option>
            <option value="high">High</option>
          </Select>
        </Field>
        <Field label="Member (optional)" htmlFor="member_id">
          <Select id="member_id" name="member_id" defaultValue="">
            <option value="">Not linked</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Assign to" htmlFor="assigned_to">
          <Select id="assigned_to" name="assigned_to" defaultValue="">
            <option value="">Me</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Due date" htmlFor="due_date" error={state?.fieldErrors?.due_date}>
          <Input id="due_date" name="due_date" type="date" />
        </Field>
      </div>

      <Field label="Notes" htmlFor="description">
        <Textarea id="description" name="description" rows={2} />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create follow-up"}
      </Button>
    </form>
  );
}
