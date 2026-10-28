import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MemberForm } from "@/components/member-form";
import { Card, SectionHeader } from "@/components/ui";
import type { BranchRow } from "@/lib/types";

export const metadata = { title: "Add member" };

export default async function NewMemberPage() {
  const ctx = await requirePermission("member.create");
  const supabase = await createClient();
  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("organization_id", ctx.activeOrg.id)
    .eq("status", "active")
    .order("name");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/members" className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to directory
      </Link>
      <SectionHeader title="Add a member" description="Create a member record. Only add information you need for ministry purposes." />
      <Card>
        <MemberForm branches={(branches ?? []) as BranchRow[]} mode="create" />
      </Card>
    </div>
  );
}
