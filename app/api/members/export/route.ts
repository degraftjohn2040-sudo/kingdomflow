import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx?.activeOrg) return new NextResponse("Unauthorized", { status: 401 });
  if (!ctx.permissions.includes("member.export")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .select("first_name, last_name, email, phone, gender, marital_status, city, status, joined_on, branch_id")
    .eq("organization_id", ctx.activeOrg.id)
    .is("archived_at", null)
    .order("last_name")
    .limit(5000);

  if (error) return new NextResponse("Export failed", { status: 500 });

  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("organization_id", ctx.activeOrg.id);
  const branchNames = new Map((branches ?? []).map((b) => [b.id, b.name]));

  const rows = (data ?? []).map((row) => ({
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email ?? "",
    phone: row.phone ?? "",
    gender: row.gender ?? "",
    marital_status: row.marital_status ?? "",
    city: row.city ?? "",
    status: row.status,
    joined_on: row.joined_on ?? "",
    branch: branchNames.get(row.branch_id) ?? "",
  }));

  const csv = toCsv(rows, [
    "first_name", "last_name", "email", "phone", "gender", "marital_status", "city", "status", "joined_on", "branch",
  ]);

  await supabase.rpc("log_audit_action", {
    p_org_id: ctx.activeOrg.id,
    p_user_id: ctx.user.id,
    p_action: "member.exported",
    p_resource_type: "member",
    p_details: { count: rows.length },
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kingdomflow-members-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
