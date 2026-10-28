"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { contributionSchema, expenseSchema, zodFieldErrors } from "@/lib/validation";
import { FAIL, OK, toUserMessage, type ActionState } from "@/lib/errors";

export async function recordContribution(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission("finance.manage");
  const parsed = contributionSchema.safeParse({
    amount: formData.get("amount"),
    category: formData.get("category"),
    payment_method: formData.get("payment_method") ?? "cash",
    given_at: formData.get("given_at"),
    branch_id: formData.get("branch_id") ?? "",
    member_id: formData.get("member_id") ?? "",
    reference: formData.get("reference"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return FAIL("Please check the highlighted fields", zodFieldErrors(parsed.error));

  const supabase = await createClient();
  const receipt = `KF-${Date.now().toString(36).toUpperCase()}`;
  const { error } = await supabase.from("contributions").insert({
    organization_id: ctx.activeOrg.id,
    branch_id: parsed.data.branch_id || null,
    member_id: parsed.data.member_id || null,
    amount: parsed.data.amount,
    currency: ctx.activeOrg.currency,
    category: parsed.data.category,
    payment_method: parsed.data.payment_method,
    given_at: parsed.data.given_at,
    reference: parsed.data.reference,
    notes: parsed.data.notes,
    receipt_number: receipt,
    recorded_by: ctx.user.id,
  });
  if (error) return FAIL(toUserMessage(error, "We could not record this contribution."));

  await supabase.rpc("log_audit_action", {
    p_org_id: ctx.activeOrg.id,
    p_user_id: ctx.user.id,
    p_action: "finance.contribution_recorded",
    p_resource_type: "contribution",
    p_details: { amount: parsed.data.amount, category: parsed.data.category },
  });

  revalidatePath("/giving");
  return OK(`Contribution recorded. Receipt ${receipt}.`);
}

export async function recordExpense(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requirePermission("finance.manage");
  const parsed = expenseSchema.safeParse({
    amount: formData.get("amount"),
    category: formData.get("category"),
    description: formData.get("description"),
    payment_method: formData.get("payment_method") ?? "cash",
    incurred_at: formData.get("incurred_at"),
    branch_id: formData.get("branch_id") ?? "",
    reference: formData.get("reference"),
  });
  if (!parsed.success) return FAIL("Please check the highlighted fields", zodFieldErrors(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.from("expense_records").insert({
    organization_id: ctx.activeOrg.id,
    branch_id: parsed.data.branch_id || null,
    amount: parsed.data.amount,
    currency: ctx.activeOrg.currency,
    category: parsed.data.category,
    description: parsed.data.description,
    payment_method: parsed.data.payment_method,
    incurred_at: parsed.data.incurred_at,
    reference: parsed.data.reference,
    recorded_by: ctx.user.id,
  });
  if (error) return FAIL(toUserMessage(error, "We could not record this expense."));
  revalidatePath("/giving");
  return OK("Expense recorded.");
}
