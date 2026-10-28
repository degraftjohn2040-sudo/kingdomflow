import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MemberImport } from "@/components/member-import";
import { SectionHeader } from "@/components/ui";
import type { BranchRow } from "@/lib/types";

export const metadata = { title: "Import members" };
export const dynamic = "force-dynamic";

export default async function ImportMembersPage() {
  const ctx = await requirePermission("member.import");
  const supabase = await createClient();
  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("organization_id", ctx.activeOrg.id)
    .order("name");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/members" className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to directory
      </Link>
      <SectionHeader
        title="Import members from CSV"
        description="Map your columns, review every row and resolve problems before anything is written."
      />
      <MemberImport branches={(branches ?? []) as BranchRow[]} />
    </div>
  );
}
