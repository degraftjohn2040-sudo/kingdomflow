"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ORG_COOKIE } from "@/lib/auth";
import { loginSchema, signupSchema, zodFieldErrors } from "@/lib/validation";
import { FAIL, OK, toUserMessage, type ActionState } from "@/lib/errors";

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return FAIL("Check the form below", zodFieldErrors(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    if (/Email not confirmed/i.test(error.message)) {
      redirect(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
    }
    return FAIL(toUserMessage(error));
  }
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signupSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return FAIL("Check the form below", zodFieldErrors(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${appUrl()}/auth/callback?next=/onboarding`,
    },
  });
  if (error) return FAIL(toUserMessage(error));

  if (!data.session) {
    redirect(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
  }
  revalidatePath("/", "layout");
  redirect("/onboarding");
}

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email.includes("@")) return FAIL("Enter a valid email address", { email: "Enter a valid email address" });

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl()}/auth/callback?next=/reset-password`,
  });
  if (error) return FAIL(toUserMessage(error));
  return OK("If an account exists for that address, a reset link is on its way.");
}

export async function updatePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  if (password.length < 8) return FAIL("Use at least 8 characters", { password: "Use at least 8 characters" });
  if (password !== confirm) return FAIL("Passwords do not match", { confirmPassword: "Passwords do not match" });

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return FAIL(toUserMessage(error));
  redirect("/dashboard");
}

export async function resendVerification(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email.includes("@")) return FAIL("Enter a valid email address");
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${appUrl()}/auth/callback?next=/onboarding` },
  });
  if (error) return FAIL(toUserMessage(error));
  return OK("Verification email sent. Check your inbox.");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const store = await cookies();
  store.delete(ORG_COOKIE);
  revalidatePath("/", "layout");
  redirect("/login");
}
