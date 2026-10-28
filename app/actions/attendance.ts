"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { sessionSchema, zodFieldErrors } from "@/lib/validation";
import { FAIL, OK, toUserMessage, type ActionState } from "@/lib/errors";

export async function createSession(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission("attendance.manage");
  const parsed = sessionSchema.safeParse({
    title: formData.get("title"),
    session_date: formData.get("session_date"),
    event_id: formData.get("event_id") ?? "",
    branch_id: formData.get("branch_id") ?? "",
  });
  if (!parsed.success) return FAIL("Please check the highlighted fields", zodFieldErrors(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance_sessions")
    .insert({
      organization_id: ctx.activeOrg.id,
      title: parsed.data.title,
      session_date: parsed.data.session_date,
      event_id: parsed.data.event_id || null,
      branch_id: parsed.data.branch_id || null,
      created_by: ctx.user.id,
    })
    .select("id")
    .single();
  if (error) return FAIL(toUserMessage(error, "We could not create this session."));

  revalidatePath("/attendance");
  return { ok: true, message: `Session created. Open it to take attendance.`, fieldErrors: { id: data.id } };
}

type AttendanceItem = { member_id: string; status: string; client_ref?: string };

/** Idempotent batch write used by both the live roster and the offline sync queue. */
export async function syncAttendance(
  sessionId: string,
  items: AttendanceItem[],
): Promise<{ ok: boolean; message?: string; count?: number }> {
  const ctx = await requirePermission("attendance.manage");
  if (!Array.isArray(items) || items.length === 0) return { ok: true, count: 0 };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_attendance", {
    target_org: ctx.activeOrg.id,
    p_session: sessionId,
    records: items.map((item) => ({
      member_id: item.member_id,
      status: item.status,
      client_ref: item.client_ref ?? null,
    })),
  });
  if (error) return { ok: false, message: toUserMessage(error, "Attendance could not be saved.") };
  revalidatePath(`/attendance/${sessionId}`);
  revalidatePath("/attendance");
  return { ok: true, count: Number(data ?? 0) };
}

export async function startQrCheckin(sessionId: string, ttlMinutes = 120) {
  const ctx = await requirePermission("attendance.manage");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_qr_checkin", {
    target_org: ctx.activeOrg.id,
    p_session: sessionId,
    ttl_minutes: ttlMinutes,
  });
  if (error) return { ok: false as const, message: toUserMessage(error) };
  revalidatePath(`/attendance/${sessionId}`);
  return { ok: true as const, data: data as { secret: string; expires_at: string; session_id: string } };
}

export async function closeSession(formData: FormData) {
  const ctx = await requirePermission("attendance.manage");
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance_sessions")
    .update({ closed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", ctx.activeOrg.id);
  if (error) throw new Error(toUserMessage(error));
  revalidatePath(`/attendance/${id}`);
  revalidatePath("/attendance");
}

export async function archiveSession(formData: FormData) {
  const ctx = await requirePermission("attendance.manage");
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance_sessions")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", ctx.activeOrg.id);
  if (error) throw new Error(toUserMessage(error));
  revalidatePath("/attendance");
}

export async function selfCheckIn(
  orgId: string,
  sessionId: string,
  secret: string,
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("self_check_in", {
    target_org: orgId,
    p_session: sessionId,
    secret,
  });
  if (error) return { ok: false, message: toUserMessage(error, "Check-in failed.") };
  const result = data as { status?: string; attendance_status?: string };
  if (result?.status === "already_recorded") {
    return { ok: true, message: `You are already checked in (${result.attendance_status}).` };
  }
  revalidatePath(`/attendance/${sessionId}`);
  return { ok: true, message: "You are checked in. God bless you!" };
}

export async function reopenSession(formData: FormData) {
  const ctx = await requirePermission("attendance.manage");
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance_sessions")
    .update({ closed_at: null })
    .eq("id", id)
    .eq("organization_id", ctx.activeOrg.id);
  if (error) throw new Error(toUserMessage(error));
  revalidatePath(`/attendance/${id}`);
}
