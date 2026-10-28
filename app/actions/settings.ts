"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { orgSettingsSchema, zodFieldErrors } from "@/lib/validation";
import { FAIL, OK, toUserMessage, type ActionState } from "@/lib/errors";

export async function updateOrganization(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission("org.manage");
  const parsed = orgSettingsSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    phone: formData.get("phone"),
    email: formData.get("email") ?? "",
    website: formData.get("website"),
    address: formData.get("address"),
    city: formData.get("city"),
    currency: formData.get("currency"),
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) return FAIL("Please check the highlighted fields", zodFieldErrors(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      name: parsed.data.name,
      description: parsed.data.description,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
      website: parsed.data.website,
      address: parsed.data.address,
      city: parsed.data.city,
      currency: parsed.data.currency,
      timezone: parsed.data.timezone,
    })
    .eq("id", ctx.activeOrg.id);
  if (error) return FAIL(toUserMessage(error, "We could not save your settings."));

  await supabase.rpc("log_audit_action", {
    p_org_id: ctx.activeOrg.id,
    p_user_id: ctx.user.id,
    p_action: "organization.updated",
    p_resource_type: "organization",
    p_resource_id: ctx.activeOrg.id,
  });

  revalidatePath("/", "layout");
  return OK("Organization settings saved.");
}

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return FAIL("Your session expired. Please sign in again.");

  const fullName = String(formData.get("fullName") ?? "").trim().slice(0, 120);
  const phone = String(formData.get("phone") ?? "").trim().slice(0, 30);
  if (fullName.length < 2) return FAIL("Enter your full name", { fullName: "Enter your full name" });

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, phone, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return FAIL(toUserMessage(error, "We could not save your profile."));
  revalidatePath("/settings");
  return OK("Profile updated.");
}
