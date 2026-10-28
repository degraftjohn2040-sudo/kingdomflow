"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { eventSchema, zodFieldErrors } from "@/lib/validation";
import { FAIL, OK, toUserMessage, type ActionState } from "@/lib/errors";

export async function saveEvent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission("event.manage");
  const id = String(formData.get("id") ?? "");
  const parsed = eventSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    type: formData.get("type"),
    start_time: formData.get("start_time"),
    end_time: formData.get("end_time"),
    location: formData.get("location"),
    branch_id: formData.get("branch_id") ?? "",
    capacity: formData.get("capacity") ?? "",
    status: formData.get("status") ?? "scheduled",
  });
  if (!parsed.success) return FAIL("Please check the highlighted fields", zodFieldErrors(parsed.error));

  const supabase = await createClient();
  const payload = {
    organization_id: ctx.activeOrg.id,
    title: parsed.data.title,
    description: parsed.data.description,
    type: parsed.data.type,
    start_time: new Date(parsed.data.start_time).toISOString(),
    end_time: new Date(parsed.data.end_time).toISOString(),
    timezone: ctx.activeOrg.timezone,
    location: parsed.data.location,
    branch_id: parsed.data.branch_id || null,
    capacity: typeof parsed.data.capacity === "number" ? parsed.data.capacity : null,
    status: parsed.data.status,
  };

  const query = id
    ? supabase.from("events").update(payload).eq("id", id).eq("organization_id", ctx.activeOrg.id)
    : supabase.from("events").insert({ ...payload, created_by: ctx.user.id, organizer_id: ctx.user.id });

  const { error } = await query;
  if (error) return FAIL(toUserMessage(error, "We could not save this event."));

  revalidatePath("/events");
  revalidatePath("/dashboard");
  return OK(id ? "Event updated." : "Event created.");
}

export async function cancelEvent(formData: FormData) {
  const ctx = await requirePermission("event.manage");
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("organization_id", ctx.activeOrg.id);
  if (error) throw new Error(toUserMessage(error));
  revalidatePath("/events");
}

export async function registerForEvent(formData: FormData) {
  const ctx = await requirePermission("event.manage");
  const eventId = String(formData.get("event_id") ?? "");
  const memberId = String(formData.get("member_id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("register_event", {
    target_org: ctx.activeOrg.id,
    p_event: eventId,
    p_member: memberId,
  });
  if (error) throw new Error(toUserMessage(error));
  revalidatePath("/events");
}
