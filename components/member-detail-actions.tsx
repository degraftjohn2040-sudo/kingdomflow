"use client";

import { useActionState, useState, useTransition } from "react";
import { Archive, Check, UserCheck } from "lucide-react";
import { archiveMember, savePastoralNote, setMemberDepartments } from "@/app/actions/members";
import { convertVisitor, setFollowupStatus } from "@/app/actions/people";
import { Alert, Button, Field, Select, Textarea } from "@/components/ui";

/** Archive is reversible in the database and never deletes attendance or giving history. */
export function ArchiveMemberPanel({ memberId }: { memberId: string }) {
  const [state, action, pending] = useActionState(archiveMember, null);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button type="button" variant="secondary" onClick={() => setConfirming(true)}>
        <Archive className="h-4 w-4" aria-hidden /> Archive member
      </Button>
    );
  }

  return (
    <form action={action} className="w-full space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
      <input type="hidden" name="id" value={memberId} />
      <p className="text-xs text-amber-900">
        Archiving removes this person from the active directory while keeping their attendance, giving and audit
        history intact.
      </p>
      {state?.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}
      <div className="flex gap-2">
        <Button type="submit" variant="danger" size="sm" disabled={pending}>
          {pending ? "Archiving…" : "Yes, archive"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function DepartmentAssigner({
  memberId,
  departments,
  assigned,
}: {
  memberId: string;
  departments: Array<{ id: string; name: string }>;
  assigned: Array<{ id: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(setMemberDepartments, null);
  const assignedIds = new Set(assigned.map((d) => d.id));

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={memberId} />
      {state?.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}

      {departments.length === 0 ? (
        <p className="text-xs text-ink-500">No departments exist yet. Create one under Departments.</p>
      ) : (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {departments.map((dept) => (
            <label key={dept.id} className="flex items-center gap-2 text-xs text-ink-700">
              <input
                type="checkbox"
                name="department_ids"
                value={dept.id}
                defaultChecked={assignedIds.has(dept.id)}
                className="h-4 w-4"
              />
              {dept.name}
            </label>
          ))}
        </div>
      )}

      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Save departments"}
      </Button>
    </form>
  );
}

export function PastoralNoteEditor({ memberId, note }: { memberId: string; note: string }) {
  const [state, action, pending] = useActionState(savePastoralNote, null);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={memberId} />
      {state?.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}
      <Field label="Pastoral notes" htmlFor="body" hint="Visible only to roles with pastoral-note permission.">
        <Textarea id="body" name="body" rows={5} defaultValue={note} placeholder="Confidential pastoral context…" />
      </Field>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save note"}
      </Button>
    </form>
  );
}

export function ConvertVisitorButton({
  id,
  first_name,
  last_name,
}: {
  id: string;
  first_name: string;
  last_name: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-end">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const formData = new FormData();
            formData.set("id", id);
            formData.set("first_name", first_name);
            formData.set("last_name", last_name);
            try {
              await convertVisitor(formData);
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "Could not convert this visitor.");
            }
          });
        }}
      >
        <UserCheck className="h-3.5 w-3.5" aria-hidden />
        {pending ? "Converting…" : "Make member"}
      </Button>
      {error ? <span className="mt-1 max-w-[16rem] text-right text-[10px] text-red-600">{error}</span> : null}
    </span>
  );
}

export function FollowupStatusButtons({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function move(status: string) {
    setError(null);
    start(async () => {
      const formData = new FormData();
      formData.set("id", id);
      formData.set("status", status);
      try {
        await setFollowupStatus(formData);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not update this follow-up.");
      }
    });
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <span className="flex gap-1.5">
        <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => move("in_progress")}>
          In progress
        </Button>
        <Button type="button" size="sm" variant="primary" disabled={pending} onClick={() => move("done")}>
          <Check className="h-3.5 w-3.5" aria-hidden /> Done
        </Button>
      </span>
      {error ? <span className="text-[10px] text-red-600">{error}</span> : null}
    </span>
  );
}
