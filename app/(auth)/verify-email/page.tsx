import Link from "next/link";
import { VerifyEmailResend } from "@/components/auth-forms";

export const metadata = { title: "Verify your email" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email = "" } = await searchParams;
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold">Check your inbox</h1>
      <p className="mt-1 text-sm text-ink-500">
        We sent a verification link{email ? ` to ${email}` : ""}. Open it to activate your account, then sign in.
      </p>
      <div className="mt-6 space-y-3">
        {email ? <VerifyEmailResend email={email} /> : null}
        <Link
          href="/login"
          className="block rounded-lg border border-ink-300 px-4 py-2.5 text-center text-sm font-semibold text-ink-700 hover:bg-ink-50"
        >
          Back to sign in
        </Link>
      </div>
      <p className="mt-6 text-[11px] leading-relaxed text-ink-400">
        Verification links expire for your security. If your link has expired, request a new one above.
      </p>
    </div>
  );
}
