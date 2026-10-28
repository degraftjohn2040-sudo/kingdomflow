"use client";

import { useState } from "react";
import { Alert, Button } from "@/components/ui";
import { selfCheckIn } from "@/app/actions/attendance";

export function SelfCheckIn({ orgId, sessionId, secret }: { orgId: string; sessionId: string; secret: string }) {
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-3">
      {state ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}
      <Button
        className="w-full"
        size="lg"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setState(await selfCheckIn(orgId, sessionId, secret));
          setBusy(false);
        }}
      >
        {busy ? "Checking in…" : "Check me in"}
      </Button>
      <p className="text-center text-[11px] text-ink-400">
        Your account must be linked to a member record in this organization. If it is not, ask a welcome-team member to
        mark you present.
      </p>
    </div>
  );
}
