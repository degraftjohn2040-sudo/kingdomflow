import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-5 text-center">
      <p className="font-display text-5xl font-semibold text-ink-300">404</p>
      <h1 className="mt-3 font-display text-2xl font-semibold">We could not find that page</h1>
      <p className="mt-2 text-sm text-ink-500">
        The record may have been archived, or the link may belong to another organization.
      </p>
      <Link href="/dashboard" className="mt-6 rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white">
        Back to dashboard
      </Link>
    </div>
  );
}
