"use client";

import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export function SearchInput({ placeholder = "Search…", param = "q" }: { placeholder?: string; param?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get(param) ?? "");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const current = params.get(param) ?? "";
    if (value === current) return;
    const timeout = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(param, value);
      else next.delete(param);
      next.delete("page");
      startTransition(() => router.replace(`?${next.toString()}`, { scroll: false }));
    }, 320);
    return () => clearTimeout(timeout);
  }, [value, param, params, router]);

  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="kf-input pl-9"
      />
      {isPending ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-ink-400">…</span> : null}
    </div>
  );
}
