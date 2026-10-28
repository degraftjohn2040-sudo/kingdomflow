import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-forms";
import { getAuthContext } from "@/lib/auth";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const ctx = await getAuthContext();
  if (ctx) redirect(ctx.activeOrg ? "/dashboard" : "/onboarding");
  const { error } = await searchParams;

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold">Welcome back</h1>
      <p className="mb-6 mt-1 text-sm text-ink-500">Sign in to your KingdomFlow workspace.</p>
      {error ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          That sign-in link is invalid or has expired. Please try again.
        </p>
      ) : null}
      <LoginForm />
      <p className="mt-6 text-center text-[11px] leading-relaxed text-ink-400">
        By signing in you agree to keep member data confidential and to use it only for ministry purposes.
      </p>
      <p className="mt-2 text-center text-xs">
        <Link href="/" className="text-ink-500 hover:underline">
          ← Back to kingdomflow.com
        </Link>
      </p>
    </div>
  );
}
