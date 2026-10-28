import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth-forms";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=expired");

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold">Choose a new password</h1>
      <p className="mb-6 mt-1 text-sm text-ink-500">Use at least 8 characters and keep it unique.</p>
      <ResetPasswordForm />
    </div>
  );
}
