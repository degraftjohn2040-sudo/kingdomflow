"use client";

import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { useRef, useState } from "react";
import { switchOrganization } from "@/app/actions/org";

type Org = { id: string; name: string; role: string };

export function OrgSwitcher({ organizations, activeId }: { organizations: Org[]; activeId: string }) {
  const [open, setOpen] = useState(false);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const active = organizations.find((o) => o.id === activeId);

  if (organizations.length <= 1) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
        <Building2 className="h-4 w-4 text-gold-400" aria-hidden />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{active?.name ?? "Workspace"}</p>
          <p className="text-[10px] uppercase tracking-wider text-ink-400">{active?.role.replace(/_/g, " ")}</p>
        </div>
      </div>
    );
  }

  return (
    <details
      ref={detailsRef}
      className="group relative"
      open={open}
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg bg-white/5 px-3 py-2 hover:bg-white/10">
        <Building2 className="h-4 w-4 text-gold-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{active?.name ?? "Workspace"}</p>
          <p className="text-[10px] uppercase tracking-wider text-ink-400">
            {organizations.length} organizations
          </p>
        </div>
        <ChevronsUpDown className="h-3.5 w-3.5 text-ink-400" aria-hidden />
      </summary>
      <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-lg border border-ink-700 bg-ink-900 shadow-xl">
        {organizations.map((org) => (
          <form key={org.id} action={switchOrganization}>
            <input type="hidden" name="organizationId" value={org.id} />
            <button
              type="submit"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-200 hover:bg-white/5"
            >
              <span className="flex-1 truncate">{org.name}</span>
              {org.id === activeId ? <Check className="h-3.5 w-3.5 text-gold-400" aria-hidden /> : null}
            </button>
          </form>
        ))}
      </div>
    </details>
  );
}
