"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { inviteSchema, zodFieldErrors } from "@/lib/validation";
import { FAIL, OK, toUserMessage, type ActionState, type FormState } from "@/lib/errors";

export type InviteState = (FormState & { inviteUrl?: string }) | null;

export async function inviteStaff(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const ctx = await requirePermission("staff.manage");
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) return FAIL("Please check the highlighted fields", zodFieldErrors(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invite_staff", {
    target_org: ctx.activeOrg.id,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
    p_branch_ids: [],
  });
  if (error) return FAIL(toUserMessage(error, "We could not create the invitation."));

  const token = (data as { token?: string } | null)?.token;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  revalidatePath("/team");
  return {
    ok: true,
    message: `Invitation created for ${parsed.data.email}. Share the link below — it expires in 7 days.`,
    inviteUrl: token ? `${appUrl}/invite/${token}` : undefined,
  };
}

export async function changeMembership(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission("staff.manage");
  const userId = String(formData.get("user_id") ?? "");
  const role = String(formData.get("role") ?? "");
  const status = String(formData.get("status") ?? "active");

  const supabase = await createClient();
  const { error } = await supabase.rpc("change_membership", {
    target_org: ctx.activeOrg.id,
    target_user: userId,
    new_role: role || null,
    new_status: status,
  });
  if (error) return FAIL(toUserMessage(error, "We could not update this team member."));
  revalidatePath("/team");
  return OK("Team access updated.");
}

export async function revokeInvitation(formData: FormData) {
  const ctx = await requirePermission("staff.manage");
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invitation", {
    target_org: ctx.activeOrg.id,
    invitation_id: id,
  });
  if (error) throw new Error(toUserMessage(error));
  revalidatePath("/team");
}
