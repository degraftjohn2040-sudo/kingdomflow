import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { OnboardingForm } from "@/components/onboarding-form";
import { signOut } from "@/app/actions/auth";

export const metadata = { title: "Set up your workspace" };

export default async function OnboardingPage() {
  const ctx = await requireAuth();
  if (ctx.activeOrg) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink-950 font-display text-sm font-bold text-gold-400">
            K
          </span>
          <span className="font-display text-lg font-semibold">KingdomFlow</span>
        </div>
        <form action={signOut}>
          <button className="text-xs font-semibold text-ink-500 hover:underline">Sign out</button>
        </form>
      </div>

      <div className="kf-card p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-royal-700">Step 1 of 1</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Create your workspace</h1>
        <p className="mb-8 mt-2 text-sm text-ink-500">
          Tell us about your church or ministry. You will become the organization owner and can invite your team
          straight after.
        </p>
        <OnboardingForm defaultName={ctx.user.fullName} defaultEmail={ctx.user.email} />
      </div>
    </div>
  );
}
