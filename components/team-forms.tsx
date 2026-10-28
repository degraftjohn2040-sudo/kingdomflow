"use client";

import { useActionState } from "react";
import { Alert, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { changeMembership, inviteStaff, type InviteState } from "@/app/actions/team";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/permissions";

export function InviteForm() {
  const [state, action] = useActionState<InviteState, FormData>(inviteStaff, null);

  return (
    <form action={action} className="space-y-3">
      {state?.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}
      {state?.inviteUrl ? (
        <div className="rounded-lg border border-royal-200 bg-royal-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-royal-800">Invitation link</p>
          <p className="mt-1 break-all text-xs text-royal-900">{state.inviteUrl}</p>
          <p className="mt-1 text-[11px] text-royal-700">
            Send this link to the invitee. It can only be used by the invited email address and expires in 7 days.
          </p>
        </div>
      ) : null}
      <Field label="Email address" htmlFor="email" error={state?.fieldErrors?.email}>
        <Input id="email" name="email" type="email" required placeholder="pastor@church.org" />
      </Field>
      <Field label="Role" htmlFor="role">
        <Select id="role" name="role" defaultValue="viewer">
          {ROLES.filter((role) => role !== "owner").map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </Select>
      </Field>
      <SubmitButton className="w-full" pendingLabel="Creating…">
        Create invitation
      </SubmitButton>
      <p className="text-[11px] leading-relaxed text-ink-400">
        Email delivery is not configured in this deployment, so the link is shown here for you to share securely.
        Only an owner can grant admin or senior pastor roles.
      </p>
    </form>
  );
}

export function MembershipControls({
  userId,
  role,
  status,
  isSelf,
}: {
  userId: string;
  role: string;
  status: string;
  isSelf: boolean;
}) {
  const [state, action] = useActionState(changeMembership, null);

  if (isSelf) {
    return <span className="text-[11px] text-ink-400">This is you</span>;
  }

  return (
    <form action={action} className="flex items-center gap-1.5">
      {state?.message ? (
        <span className={`text-[11px] ${state.ok ? "text-emerald-700" : "text-red-600"}`}>{state.message}</span>
      ) : null}
      <input type="hidden" name="user_id" value={userId} />
      <select name="role" defaultValue={role} className="kf-input h-8 w-auto py-0 text-xs" aria-label="Role">
        {(ROLES as readonly Role[]).map((option) => (
          <option key={option} value={option}>
            {ROLE_LABELS[option]}
          </option>
        ))}
      </select>
      <select name="status" defaultValue={status} className="kf-input h-8 w-auto py-0 text-xs" aria-label="Status">
        <option value="active">Active</option>
        <option value="suspended">Suspended</option>
      </select>
      <SubmitButton size="sm" variant="secondary" pendingLabel="Saving…">
        Update
      </SubmitButton>
    </form>
  );
}
