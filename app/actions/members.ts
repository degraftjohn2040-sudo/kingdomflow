"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { memberSchema, zodFieldErrors } from "@/lib/validation";
import { FAIL, OK, toUserMessage, type ActionState } from "@/lib/errors";

function nullable(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

export async function createMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission("member.create");
  const parsed = memberSchema.safeParse({
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    email: formData.get("email") ?? "",
    phone: formData.get("phone"),
    gender: formData.get("gender") ?? "",
    marital_status: formData.get("marital_status") ?? "",
    date_of_birth: formData.get("date_of_birth") ?? "",
    address: formData.get("address"),
    city: formData.get("city"),
    branch_id: formData.get("branch_id") ?? "",
    status: formData.get("status") ?? "active",
    joined_on: formData.get("joined_on") ?? "",
  });
  if (!parsed.success) return FAIL("Please check the highlighted fields", zodFieldErrors(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .insert({
      organization_id: ctx.activeOrg.id,
      branch_id: parsed.data.branch_id || null,
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      email: parsed.data.email || null,
      phone: parsed.data.phone,
      gender: parsed.data.gender || null,
      marital_status: parsed.data.marital_status || null,
      date_of_birth: parsed.data.date_of_birth || null,
      address: parsed.data.address,
      city: parsed.data.city,
      status: parsed.data.status,
      join_date: parsed.data.joined_on || null,
      joined_on: parsed.data.joined_on || null,
      created_by: ctx.user.id,
    })
    .select("id")
    .single();

  if (error) return FAIL(toUserMessage(error, "We could not save this member."));

  await supabase.rpc("log_audit_action", {
    p_org_id: ctx.activeOrg.id,
    p_user_id: ctx.user.id,
    p_action: "member.created",
    p_resource_type: "member",
    p_resource_id: data.id,
    p_details: { name: `${parsed.data.first_name} ${parsed.data.last_name}` },
  });

  revalidatePath("/members");
  redirect(`/members/${data.id}`);
}

export async function updateMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission("member.update");
  const id = String(formData.get("id") ?? "");
  if (!id) return FAIL("Missing member reference");

  const parsed = memberSchema.safeParse({
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    email: formData.get("email") ?? "",
    phone: formData.get("phone"),
    gender: formData.get("gender") ?? "",
    marital_status: formData.get("marital_status") ?? "",
    date_of_birth: formData.get("date_of_birth") ?? "",
    address: formData.get("address"),
    city: formData.get("city"),
    branch_id: formData.get("branch_id") ?? "",
    status: formData.get("status") ?? "active",
    joined_on: formData.get("joined_on") ?? "",
  });
  if (!parsed.success) return FAIL("Please check the highlighted fields", zodFieldErrors(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase
    .from("members")
    .update({
      branch_id: parsed.data.branch_id || null,
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      email: parsed.data.email || null,
      phone: parsed.data.phone,
      gender: parsed.data.gender || null,
      marital_status: parsed.data.marital_status || null,
      date_of_birth: parsed.data.date_of_birth || null,
      address: parsed.data.address,
      city: parsed.data.city,
      status: parsed.data.status,
      join_date: parsed.data.joined_on || null,
      joined_on: parsed.data.joined_on || null,
    })
    .eq("id", id)
    .eq("organization_id", ctx.activeOrg.id);

  if (error) return FAIL(toUserMessage(error, "We could not update this member."));

  await supabase.rpc("log_audit_action", {
    p_org_id: ctx.activeOrg.id,
    p_user_id: ctx.user.id,
    p_action: "member.updated",
    p_resource_type: "member",
    p_resource_id: id,
  });

  revalidatePath(`/members/${id}`);
  revalidatePath("/members");
  return OK("Member updated.");
}

export async function archiveMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("member.archive");
  const id = String(formData.get("id") ?? "");
  const reason = nullable(formData.get("reason"));
  const ctx = await requirePermission("member.archive");
  const supabase = await createClient();
  const { error } = await supabase.rpc("archive_member", {
    target_org: ctx.activeOrg.id,
    p_member: id,
    reason,
  });
  if (error) return FAIL(toUserMessage(error, "We could not archive this member."));
  revalidatePath("/members");
  revalidatePath(`/members/${id}`);
  return OK("Member archived. Their history is preserved.");
}

export async function savePastoralNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission("member.notes.manage");
  const id = String(formData.get("id") ?? "");
  const body = String(formData.get("body") ?? "").slice(0, 5000);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_pastoral_note", {
    target_org: ctx.activeOrg.id,
    p_member: id,
    body,
  });
  if (error) return FAIL(toUserMessage(error, "We could not save the pastoral note."));
  revalidatePath(`/members/${id}`);
  return OK("Pastoral note saved.");
}

export async function setMemberDepartments(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission("department.manage");
  const id = String(formData.get("id") ?? "");
  const departmentId = String(formData.get("department_id") ?? "");
  const mode = String(formData.get("mode") ?? "add");
  const supabase = await createClient();

  if (mode === "remove") {
    const { error } = await supabase
      .from("department_members")
      .delete()
      .eq("department_id", departmentId)
      .eq("member_id", id);
    if (error) return FAIL(toUserMessage(error));
  } else {
    const { error } = await supabase
      .from("department_members")
      .insert({ department_id: departmentId, member_id: id, role: "member" });
    if (error) return FAIL(toUserMessage(error, "That member may already be in this department."));
  }
  revalidatePath(`/members/${id}`);
  revalidatePath("/departments");
  return OK(mode === "remove" ? "Removed from department." : "Added to department.");
}

export async function importMembers(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission("member.import");
  const raw = String(formData.get("payload") ?? "");
  let rows: Array<Record<string, string>>;
  try {
    rows = JSON.parse(raw) as Array<Record<string, string>>;
  } catch {
    return FAIL("The import data could not be read.");
  }
  if (!Array.isArray(rows) || rows.length === 0) return FAIL("There are no rows to import.");
  if (rows.length > 500) return FAIL("Import at most 500 members at a time.");

  const supabase = await createClient();
  const branchId = nullable(formData.get("branch_id"));
  const prepared = rows.map((row) => ({
    organization_id: ctx.activeOrg.id,
    branch_id: (row.branch_id || branchId) ?? null,
    first_name: String(row.first_name ?? "").trim().slice(0, 80),
    last_name: String(row.last_name ?? "").trim().slice(0, 80),
    email: String(row.email ?? "").trim().toLowerCase() || null,
    phone: String(row.phone ?? "").trim() || null,
    gender: ["male", "female", "other"].includes(String(row.gender ?? "").toLowerCase())
      ? String(row.gender).toLowerCase()
      : null,
    city: String(row.city ?? "").trim() || null,
    status: "active" as const,
    joined_on: /^\d{4}-\d{2}-\d{2}$/.test(row.joined_on ?? "") ? row.joined_on : null,
    created_by: ctx.user.id,
  }));

  const invalid = prepared.filter((row) => !row.first_name || !row.last_name);
  if (invalid.length > 0) return FAIL(`${invalid.length} row(s) are missing a first or last name.`);

  const { error, count } = await supabase.from("members").insert(prepared, { count: "exact" });
  if (error) return FAIL(toUserMessage(error, "The import failed. No records were created."));

  await supabase.rpc("log_audit_action", {
    p_org_id: ctx.activeOrg.id,
    p_user_id: ctx.user.id,
    p_action: "member.imported",
    p_resource_type: "member",
    p_details: { count: count ?? prepared.length },
  });

  revalidatePath("/members");
  return OK(`${count ?? prepared.length} member(s) imported.`);
}
