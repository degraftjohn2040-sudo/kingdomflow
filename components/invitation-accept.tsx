"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { acceptInvitation } from "@/app/actions/workspace";

export function InvitationAccept({ token }: { token: string }) {
  const [state, action] = useActionState(acceptInvitation, null);
  return (
    <form action={action} className="space-y-3">
      {state?.message && !state.ok ? <Alert tone="danger">{state.message}</Alert> : null}
      <input type="hidden" name="token" value={token} />
      <SubmitButton className="w-full" pendingLabel="Joining…">
        Accept invitation
      </SubmitButton>
    </form>
  );
}
