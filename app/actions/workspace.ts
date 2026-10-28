"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ORG_COOKIE } from "@/lib/auth";
import { onboardingSchema, zodFieldErrors } from "@/lib/validation";
import { FAIL, toUserMessage, type ActionState } from "@/lib/errors";

export async function createWorkspace(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = onboardingSchema.safeParse({
    name: formData.get("name"),
    organizationType: formData.get("organizationType"),
    country: formData.get("country"),
    city: formData.get("city"),
    timezone: formData.get("timezone"),
    currency: formData.get("currency"),
    denomination: formData.get("denomination"),
    phone: formData.get("phone"),
    email: formData.get("email") ?? "",
    fullName: formData.get("fullName"),
    branchName: formData.get("branchName"),
    departments: formData.get("departments") ?? "",
    requestKey: formData.get("requestKey"),
  });

  if (!parsed.success) return FAIL("Please check the highlighted fields", zodFieldErrors(parsed.error));
  const data = parsed.data;

  const departments = (data.departments ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 20);

  const supabase = await createClient();
  const { data: orgId, error } = await supabase.rpc("create_workspace", {
    request_key: data.requestKey,
    setup: {
      name: data.name,
      organization_type: data.organizationType,
      country: data.country,
      city: data.city ?? "",
      timezone: data.timezone,
      currency: data.currency,
      denomination: data.denomination ?? "",
      phone: data.phone ?? "",
      email: data.email ?? "",
      full_name: data.fullName,
      branch_name: data.branchName ?? "",
      departments,
    },
  });

  if (error) return FAIL(toUserMessage(error, "We could not create your workspace."));
  if (!orgId) return FAIL("We could not create your workspace. Please try again.");

  const store = await cookies();
  store.set(ORG_COOKIE, String(orgId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function acceptInvitation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  if (!/^[a-f0-9]{64}$/.test(token)) return FAIL("This invitation link is not valid.");

  const supabase = await createClient();
  const { data: orgId, error } = await supabase.rpc("accept_invitation", { invitation_token: token });
  if (error) return FAIL(toUserMessage(error, "We could not accept this invitation."));

  const store = await cookies();
  store.set(ORG_COOKIE, String(orgId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
