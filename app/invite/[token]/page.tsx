import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { InvitationAccept } from "@/components/invitation-accept";

export const metadata = { title: "Workspace invitation" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const ctx = await requireAuth();
  const { token } = await params;
  if (!/^[a-f0-9]{64}$/.test(token)) redirect("/dashboard");

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-12">
      <div className="kf-card p-7">
        <h1 className="font-display text-2xl font-semibold">You have been invited</h1>
        <p className="mt-2 text-sm text-ink-500">
          Accept this invitation to join the workspace. Your role determines what you can see and do. The invitation
          must be accepted with the email address it was sent to
          {ctx.user.email ? ` (${ctx.user.email})` : ""}.
        </p>
        <div className="mt-6">
          <InvitationAccept token={token} />
        </div>
        <Link href="/dashboard" className="mt-4 block text-center text-xs text-ink-500 hover:underline">
          Not now — go to my dashboard
        </Link>
      </div>
    </div>
  );
}
