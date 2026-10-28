"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const forbidden = /permission/i.test(error.message ?? "");

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" aria-hidden />
      <h1 className="mt-4 font-display text-2xl font-semibold">
        {forbidden ? "You do not have access to this area" : "Something went wrong"}
      </h1>
      <p className="mt-2 text-sm text-ink-500">
        {forbidden
          ? "Your role does not include the permission required for this page. Ask an organization owner if you need access."
          : "The page could not be loaded. You can retry, or return to your dashboard."}
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <button onClick={reset} className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white">
          Try again
        </button>
        <Link href="/dashboard" className="rounded-lg border border-ink-300 px-4 py-2 text-sm font-semibold text-ink-700">
          Dashboard
        </Link>
      </div>
    </div>
  );
}
