import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MemberForm } from "@/components/member-form";
import { Card, SectionHeader } from "@/components/ui";
import type { BranchRow, MemberRow } from "@/lib/types";

export const metadata = { title: "Edit member" };
export const dynamic = "force-dynamic";

export default async function EditMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission("member.update");
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: member }, { data: branches }] = await Promise.all([
    supabase
      .from("members")
      .select(
        "id, organization_id, branch_id, first_name, last_name, email, phone, gender, marital_status, address, city, status, join_date, joined_on, date_of_birth, avatar_url, created_at, archived_at",
      )
      .eq("id", id)
      .eq("organization_id", ctx.activeOrg.id)
      .maybeSingle<MemberRow>(),
    supabase.from("branches").select("id, name").eq("organization_id", ctx.activeOrg.id).order("name"),
  ]);

  if (!member) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href={`/members/${member.id}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to profile
      </Link>
      <SectionHeader title={`Edit ${member.first_name} ${member.last_name}`} description="Changes are recorded in the audit log." />
      <Card>
        <MemberForm member={member} branches={(branches ?? []) as BranchRow[]} mode="edit" />
      </Card>
    </div>
  );
}
