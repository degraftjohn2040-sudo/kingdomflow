import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Supabase email template can point here with a token hash. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") ?? "email";
  const next = searchParams.get("next") ?? "/dashboard";

  if (!tokenHash) redirect("/login?error=link");

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as "signup" | "recovery" | "email" | "invite" | "magiclink" | "email_change",
  });
  redirect(error ? "/login?error=link" : next.startsWith("/") ? next : "/dashboard");
}
