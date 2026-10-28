import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, ButtonLink, Card, SectionHeader } from "@/components/ui";
import { ArchiveMemberPanel, DepartmentAssigner, PastoralNoteEditor } from "@/components/member-detail-actions";
import { formatDate, formatMoney, initials } from "@/lib/utils";
import type { MemberRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission("member.view");
  const { id } = await params;
  const supabase = await createClient();

  const { data: member } = await supabase
    .from("members")
    .select(
      "id, organization_id, branch_id, first_name, last_name, email, phone, gender, marital_status, address, city, status, join_date, joined_on, date_of_birth, avatar_url, created_at, archived_at",
    )
    .eq("id", id)
    .eq("organization_id", ctx.activeOrg.id)
    .maybeSingle<MemberRow>();

  if (!member) notFound();

  const canNotes = ctx.permissions.includes("member.notes.view");
  const canDepartment = ctx.permissions.includes("department.manage");
  const canFinance = ctx.permissions.includes("finance.view");

  const [{ data: branch }, { data: deptLinks }, { data: allDepartments }, { data: pastoral }, attendance, giving] =
    await Promise.all([
      member.branch_id
        ? supabase.from("branches").select("name").eq("id", member.branch_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("department_members").select("department_id").eq("member_id", id),
      supabase
        .from("departments")
        .select("id, name")
        .eq("organization_id", ctx.activeOrg.id)
        .eq("status", "active")
        .order("name"),
      canNotes ? supabase.rpc("get_pastoral_note", { target_org: ctx.activeOrg.id, p_member: id }) : Promise.resolve({ data: null }),
      supabase
        .from("attendance_records")
        .select("status, checked_in_at, session_id", { count: "exact" })
        .eq("member_id", id)
        .eq("status", "present")
        .limit(1),
      canFinance
        ? supabase.from("contributions").select("amount, given_at").eq("member_id", id).order("given_at", { ascending: false }).limit(50)
        : Promise.resolve({ data: null }),
    ]);

  const deptIds = new Set((deptLinks ?? []).map((link) => link.department_id));
  const assigned = (allDepartments ?? []).filter((dept) => deptIds.has(dept.id));
  const givingTotal = (giving.data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href="/members" className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to directory
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-royal-100 font-display text-lg font-bold text-royal-800">
            {initials(member.first_name, member.last_name)}
          </span>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {member.first_name} {member.last_name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-500">
              <Badge tone={member.status === "active" ? "success" : "neutral"}>{member.status}</Badge>
              <span>{branch?.name ?? "Organization-wide"}</span>
              <span>· Joined {formatDate(member.joined_on ?? member.join_date, ctx.activeOrg.timezone)}</span>
              {member.archived_at ? <Badge tone="warning">archived</Badge> : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {ctx.permissions.includes("member.update") ? (
            <ButtonLink href={`/members/${member.id}/edit`} size="sm" variant="secondary">
              Edit details
            </ButtonLink>
          ) : null}
          {ctx.permissions.includes("member.archive") && !member.archived_at ? (
            <ArchiveMemberPanel memberId={member.id} />
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="font-display text-lg font-semibold">Contact information</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 text-ink-400" aria-hidden />
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-ink-400">Email</dt>
                <dd className="text-sm text-ink-700">{member.email ?? "Not provided"}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Phone className="mt-0.5 h-4 w-4 text-ink-400" aria-hidden />
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-ink-400">Phone</dt>
                <dd className="text-sm text-ink-700">{member.phone ?? "Not provided"}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 text-ink-400" aria-hidden />
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-ink-400">Location</dt>
                <dd className="text-sm text-ink-700">
                  {[member.city, member.address].filter(Boolean).join(", ") || "Not provided"}
                </dd>
              </div>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-ink-400">Date of birth</dt>
              <dd className="text-sm text-ink-700">{formatDate(member.date_of_birth, ctx.activeOrg.timezone)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-ink-400">Gender</dt>
              <dd className="text-sm capitalize text-ink-700">{member.gender ?? "Not stated"}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-ink-400">Marital status</dt>
              <dd className="text-sm capitalize text-ink-700">{member.marital_status ?? "Not stated"}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="font-display text-lg font-semibold">Engagement</h2>
          <dl className="mt-3 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-ink-500">Services attended</dt>
              <dd className="font-semibold tabular-nums">{attendance.count ?? 0}</dd>
            </div>
            {canFinance ? (
              <div className="flex items-center justify-between">
                <dt className="text-ink-500">Total giving</dt>
                <dd className="font-semibold tabular-nums">{formatMoney(givingTotal, ctx.activeOrg.currency)}</dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <dt className="text-ink-500">Departments</dt>
              <dd className="font-semibold tabular-nums">{assigned.length}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-500">Record created</dt>
              <dd className="text-xs">{formatDate(member.created_at, ctx.activeOrg.timezone)}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-lg font-semibold">Departments & ministry</h2>
          <p className="mb-4 mt-1 text-xs text-ink-500">Group memberships used for ministry reporting.</p>
          {canDepartment ? (
            <DepartmentAssigner memberId={member.id} departments={allDepartments ?? []} assigned={assigned} />
          ) : assigned.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {assigned.map((dept) => (
                <li key={dept.id} className="rounded-full bg-royal-50 px-3 py-1 text-xs font-semibold text-royal-800">
                  {dept.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-500">No department assignments.</p>
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-600" aria-hidden />
            <h2 className="font-display text-lg font-semibold">Pastoral notes</h2>
          </div>
          <p className="mb-4 mt-1 text-xs text-ink-500">
            Restricted to authorized pastoral roles. Not included in exports, search results or notifications.
          </p>
          {canNotes ? (
            <PastoralNoteEditor memberId={member.id} note={(pastoral.data as string | null) ?? ""} />
          ) : (
            <p className="rounded-lg bg-ink-50 p-3 text-xs text-ink-500">
              Your role does not include access to pastoral notes.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
