"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { followupSchema, visitorSchema, zodFieldErrors } from "@/lib/validation";
import { FAIL, OK, toUserMessage, type FormState } from "@/lib/errors";

export async function createVisitor(_prev: FormState | null, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("visitor.manage");
  const parsed = visitorSchema.safeParse({
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    visit_date: formData.get("visit_date"),
    branch_id: formData.get("branch_id") ?? "",
    invited_by: formData.get("invited_by") ?? "",
    how_heard: formData.get("how_heard") ?? "",
    consent_given: formData.get("consent_given") === "on",
  });
  if (!parsed.success) return FAIL("Please check the highlighted fields", zodFieldErrors(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.from("visitors").insert({
    organization_id: ctx.activeOrg.id,
    first_name: parsed.data.first_name,
    last_name: parsed.data.last_name,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    visit_date: parsed.data.visit_date,
    branch_id: parsed.data.branch_id || null,
    invited_by: parsed.data.invited_by || null,
    how_heard: parsed.data.how_heard || null,
    consent_given: parsed.data.consent_given,
    created_by: ctx.user.id,
  });
  if (error) return FAIL(toUserMessage(error, "We could not save this visitor."));

  revalidatePath("/visitors");
  return OK(`${parsed.data.first_name} was added to visitors.`);
}

export async function convertVisitor(formData: FormData) {
  const ctx = await requirePermission("visitor.manage");
  const visitorId = String(formData.get("id") ?? "");
  const first_name = String(formData.get("first_name") ?? "").trim();
  const last_name = String(formData.get("last_name") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase.rpc("convert_visitor", {
    target_org: ctx.activeOrg.id,
    p_visitor: visitorId,
    first_name,
    last_name,
  });
  if (error) throw new Error(toUserMessage(error, "This visitor could not be converted."));

  revalidatePath("/visitors");
  revalidatePath("/members");
}

export async function setVisitorFollowup(formData: FormData) {
  const ctx = await requirePermission("visitor.manage");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("followup_status") ?? "new");
  if (!["new", "contacted", "scheduled", "converted", "closed"].includes(status)) {
    throw new Error("Unknown follow-up status");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("visitors")
    .update({ followup_status: status })
    .eq("id", id)
    .eq("organization_id", ctx.activeOrg.id);
  if (error) throw new Error(toUserMessage(error));
  revalidatePath("/visitors");
}

export async function createFollowup(_prev: FormState | null, formData: FormData): Promise<FormState> {
  const ctx = await requirePermission("followup.manage");
  const parsed = followupSchema.safeParse({
    title: formData.get("title"),
    type: formData.get("type") ?? "call",
    member_id: formData.get("member_id") ?? "",
    assigned_to: formData.get("assigned_to") ?? "",
    priority: formData.get("priority") ?? "normal",
    due_date: formData.get("due_date") ?? "",
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return FAIL("Please check the highlighted fields", zodFieldErrors(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.from("followups").insert({
    organization_id: ctx.activeOrg.id,
    title: parsed.data.title,
    type: parsed.data.type,
    member_id: parsed.data.member_id || null,
    assigned_to: parsed.data.assigned_to || ctx.user.id,
    priority: parsed.data.priority,
    due_date: parsed.data.due_date || null,
    description: parsed.data.description || null,
    status: "open",
    created_by: ctx.user.id,
  });
  if (error) return FAIL(toUserMessage(error, "We could not create this follow-up."));

  revalidatePath("/followups");
  return OK("Follow-up created.");
}

export async function setFollowupStatus(formData: FormData) {
  const ctx = await requirePermission("followup.manage");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "open");
  if (!["open", "in_progress", "done", "cancelled"].includes(status)) throw new Error("Unknown status");

  const supabase = await createClient();
  const { error } = await supabase
    .from("followups")
    .update({ status, completed_at: status === "done" ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("organization_id", ctx.activeOrg.id);
  if (error) throw new Error(toUserMessage(error));
  revalidatePath("/followups");
}

export async function addFollowupNote(formData: FormData) {
  const ctx = await requirePermission("followup.manage");
  const followUpId = String(formData.get("follow_up_id") ?? "");
  const content = String(formData.get("content") ?? "").trim();
  if (content.length < 2) throw new Error("Write a short note first");

  const supabase = await createClient();
  const { error } = await supabase.from("followup_notes").insert({
    follow_up_id: followUpId,
    content,
    created_by: ctx.user.id,
  });
  if (error) throw new Error(toUserMessage(error));
  revalidatePath("/followups");
}
