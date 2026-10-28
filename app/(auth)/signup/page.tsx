import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth-forms";
import { getAuthContext } from "@/lib/auth";

export const metadata = { title: "Create account" };

export default async function SignupPage() {
  const ctx = await getAuthContext();
  if (ctx) redirect(ctx.activeOrg ? "/dashboard" : "/onboarding");

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold">Create your account</h1>
      <p className="mb-6 mt-1 text-sm text-ink-500">
        Start with a free workspace for your church or ministry. No card required.
      </p>
      <SignupForm />
      <p className="mt-4 text-center text-[11px] text-ink-400">
        You will receive an email to verify your address before creating a workspace.
      </p>
    </div>
  );
}
