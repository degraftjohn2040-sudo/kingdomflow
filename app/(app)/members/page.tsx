import Link from "next/link";
import { Download, Filter, Upload, UserPlus, Users } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, ButtonLink, Card, EmptyState, SectionHeader } from "@/components/ui";
import { SearchInput } from "@/components/search-input";
import { formatDate, initials } from "@/lib/utils";
import type { BranchRow, MemberRow } from "@/lib/types";

export const metadata = { title: "Members" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

function sanitizeSearch(value: string) {
  return value.replace(/[,()%*]/g, " ").trim().slice(0, 60);
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; branch?: string; page?: string }>;
}) {
  const ctx = await requirePermission("member.view");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const q = sanitizeSearch(params.q ?? "");
  const status = params.status ?? "";
  const branch = params.branch ?? "";

  const supabase = await createClient();
  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("organization_id", ctx.activeOrg.id)
    .order("name");

  let query = supabase
    .from("members")
    .select(
      "id, first_name, last_name, email, phone, status, branch_id, joined_on, join_date, city, archived_at",
      { count: "exact" },
    )
    .eq("organization_id", ctx.activeOrg.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
  if (status) query = query.eq("status", status);
  if (branch) query = query.eq("branch_id", branch);

  const { data: members, count, error } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const branchName = (id: string | null) =>
    (branches as BranchRow[] | null)?.find((b) => b.id === id)?.name ?? "Organization-wide";

  const buildHref = (updates: Record<string, string>) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status) next.set("status", status);
    if (branch) next.set("branch", branch);
    Object.entries(updates).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    return `/members?${next.toString()}`;
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Members"
        description={`${count ?? 0} record(s) in ${ctx.activeOrg.name}`}
        action={
          <div className="flex flex-wrap gap-2">
            {ctx.permissions.includes("member.import") ? (
              <ButtonLink href="/members/import" variant="secondary" size="sm">
                <Upload className="h-4 w-4" aria-hidden /> Import
              </ButtonLink>
            ) : null}
            {ctx.permissions.includes("member.export") ? (
              <a
                href="/api/members/export"
                className="inline-flex h-8 items-center gap-2 rounded-lg border border-ink-300 bg-white px-3 text-xs font-semibold text-ink-700 hover:bg-ink-50"
              >
                <Download className="h-4 w-4" aria-hidden /> Export CSV
              </a>
            ) : null}
            {ctx.permissions.includes("member.create") ? (
              <ButtonLink href="/members/new" size="sm">
                <UserPlus className="h-4 w-4" aria-hidden /> Add member
              </ButtonLink>
            ) : null}
          </div>
        }
      />

      <Card className="p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput placeholder="Search name, email or phone…" />
          <form className="flex flex-wrap items-center gap-2" action="/members">
            {q ? <input type="hidden" name="q" value={q} /> : null}
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-500">
              <Filter className="h-3.5 w-3.5" aria-hidden /> Filters
            </span>
            <select name="status" defaultValue={status} className="kf-input h-9 w-auto py-0 text-xs" aria-label="Status">
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="visitor">Visitor</option>
              <option value="transferred">Transferred</option>
            </select>
            <select name="branch" defaultValue={branch} className="kf-input h-9 w-auto py-0 text-xs" aria-label="Branch">
              <option value="">All branches</option>
              {(branches as BranchRow[] | null)?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <button className="h-9 rounded-lg bg-ink-900 px-3 text-xs font-semibold text-white" type="submit">
              Apply
            </button>
          </form>
        </div>
      </Card>

      {error ? (
        <Card>{error.message}</Card>
      ) : !members || members.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title={q || status || branch ? "No matching members" : "No members yet"}
            description={
              q || status || branch
                ? "Try a different search term or clear your filters."
                : "Add your first member record, or import an existing list from a CSV file."
            }
            action={
              ctx.permissions.includes("member.create") ? (
                <ButtonLink href="/members/new" size="sm">
                  Add member
                </ButtonLink>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-card md:block">
            <table className="kf-table">
              <thead>
                <tr>
                  <th scope="col">Member</th>
                  <th scope="col">Contact</th>
                  <th scope="col">Branch</th>
                  <th scope="col">Joined</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {(members as MemberRow[]).map((member) => (
                  <tr key={member.id}>
                    <td>
                      <Link href={`/members/${member.id}`} className="flex items-center gap-2.5 font-medium text-ink-800 hover:text-royal-700">
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-royal-100 text-[11px] font-bold text-royal-800">
                          {initials(member.first_name, member.last_name)}
                        </span>
                        {member.first_name} {member.last_name}
                      </Link>
                    </td>
                    <td className="text-xs">
                      <span className="block text-ink-600">{member.email ?? "—"}</span>
                      <span className="text-ink-400">{member.phone ?? ""}</span>
                    </td>
                    <td className="text-xs">{branchName(member.branch_id)}</td>
                    <td className="text-xs">{formatDate(member.joined_on ?? member.join_date, ctx.activeOrg.timezone)}</td>
                    <td>
                      <Badge tone={member.status === "active" ? "success" : member.status === "visitor" ? "info" : "neutral"}>
                        {member.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 md:hidden">
            {(members as MemberRow[]).map((member) => (
              <li key={member.id}>
                <Link href={`/members/${member.id}`} className="kf-card flex items-center gap-3 p-3.5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-royal-100 text-xs font-bold text-royal-800">
                    {initials(member.first_name, member.last_name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink-800">
                      {member.first_name} {member.last_name}
                    </span>
                    <span className="block truncate text-xs text-ink-500">{member.phone ?? member.email ?? "No contact"}</span>
                  </span>
                  <Badge tone={member.status === "active" ? "success" : "neutral"}>{member.status}</Badge>
                </Link>
              </li>
            ))}
          </ul>

          {totalPages > 1 ? (
            <nav className="flex items-center justify-between text-xs" aria-label="Pagination">
              <span className="text-ink-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Link href={buildHref({ page: String(page - 1) })} className="rounded-lg border border-ink-300 px-3 py-1.5 font-semibold hover:bg-ink-50">
                    Previous
                  </Link>
                ) : null}
                {page < totalPages ? (
                  <Link href={buildHref({ page: String(page + 1) })} className="rounded-lg border border-ink-300 px-3 py-1.5 font-semibold hover:bg-ink-50">
                    Next
                  </Link>
                ) : null}
              </div>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
