"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { branchSchema, departmentSchema, zodFieldErrors } from "@/lib/validation";
import { FAIL, OK, toUserMessage, type ActionState } from "@/lib/errors";
import { slugify } from "@/lib/utils";

export async function saveBranch(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission("branch.manage");
  const id = String(formData.get("id") ?? "");
  const parsed = branchSchema.safeParse({
    name: formData.get("name"),
    city: formData.get("city"),
    address: formData.get("address"),
    phone: formData.get("phone"),
    email: formData.get("email") ?? "",
    status: formData.get("status") ?? "active",
  });
  if (!parsed.success) return FAIL("Please check the highlighted fields", zodFieldErrors(parsed.error));

  const supabase = await createClient();
  const payload = {
    organization_id: ctx.activeOrg.id,
    name: parsed.data.name,
    slug: `${slugify(parsed.data.name)}-${Math.random().toString(36).slice(2, 6)}`,
    city: parsed.data.city,
    address: parsed.data.address,
    phone: parsed.data.phone,
    email: parsed.data.email || null,
    status: parsed.data.status,
  };

  const { error } = id
    ? await supabase
        .from("branches")
        .update({ ...payload, slug: undefined })
        .eq("id", id)
        .eq("organization_id", ctx.activeOrg.id)
    : await supabase.from("branches").insert(payload);

  if (error) return FAIL(toUserMessage(error, "We could not save this branch."));
  revalidatePath("/branches");
  return OK(id ? "Branch updated." : "Branch created.");
}

export async function saveDepartment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission("department.manage");
  const id = String(formData.get("id") ?? "");
  const parsed = departmentSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type") ?? "department",
    description: formData.get("description"),
    branch_id: formData.get("branch_id") ?? "",
    leader_id: formData.get("leader_id") ?? "",
    status: formData.get("status") ?? "active",
  });
  if (!parsed.success) return FAIL("Please check the highlighted fields", zodFieldErrors(parsed.error));

  const supabase = await createClient();
  const payload = {
    organization_id: ctx.activeOrg.id,
    name: parsed.data.name,
    slug: `${slugify(parsed.data.name)}-${Math.random().toString(36).slice(2, 5)}`,
    type: parsed.data.type,
    description: parsed.data.description,
    branch_id: parsed.data.branch_id || null,
    leader_id: parsed.data.leader_id || null,
    status: parsed.data.status,
  };

  const { error } = id
    ? await supabase
        .from("departments")
        .update({ ...payload, slug: undefined })
        .eq("id", id)
        .eq("organization_id", ctx.activeOrg.id)
    : await supabase.from("departments").insert(payload);

  if (error) return FAIL(toUserMessage(error, "We could not save this department."));
  revalidatePath("/departments");
  return OK(id ? "Department updated." : "Department created.");
}

export async function archiveDepartment(formData: FormData) {
  const ctx = await requirePermission("department.manage");
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase
    .from("departments")
    .update({ status: "inactive", archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", ctx.activeOrg.id);
  if (error) throw new Error(toUserMessage(error));
  revalidatePath("/departments");
}
