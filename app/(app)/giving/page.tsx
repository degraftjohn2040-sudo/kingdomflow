import { Banknote, HandCoins, Receipt } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, SectionHeader, Stat } from "@/components/ui";
import { ContributionForm, ExpenseForm, FinanceTabs } from "@/components/finance-forms";
import { formatDate, formatMoney } from "@/lib/utils";
import type { BranchRow } from "@/lib/types";

export const metadata = { title: "Giving & finance" };
export const dynamic = "force-dynamic";

export default async function GivingPage() {
  const ctx = await requirePermission("finance.view");
  const supabase = await createClient();
  const canManage = ctx.permissions.includes("finance.manage");

  const [{ data: branches }, { data: contributions }, { data: expenses }] = await Promise.all([
    supabase.from("branches").select("id, name").eq("organization_id", ctx.activeOrg.id).order("name"),
    supabase
      .from("contributions")
      .select("id, amount, currency, category, payment_method, given_at, receipt_number, reference, branch_id")
      .eq("organization_id", ctx.activeOrg.id)
      .order("given_at", { ascending: false })
      .limit(50),
    supabase
      .from("expense_records")
      .select("id, amount, currency, category, description, payment_method, incurred_at, reference")
      .eq("organization_id", ctx.activeOrg.id)
      .order("incurred_at", { ascending: false })
      .limit(50),
  ]);

  const totalIn = (contributions ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  const totalOut = (expenses ?? []).reduce((sum, row) => sum + Number(row.amount), 0);

  const contributionsList =
    !contributions || contributions.length === 0 ? (
      <Card>
        <EmptyState
          icon={<HandCoins className="h-7 w-7" />}
          title="No contributions recorded"
          description="Record tithes, offerings and donations to build your financial picture."
        />
      </Card>
    ) : (
      <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-card">
        <table className="kf-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Method</th>
              <th>Receipt</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {contributions.map((row) => (
              <tr key={row.id}>
                <td className="text-xs">{formatDate(row.given_at, ctx.activeOrg.timezone)}</td>
                <td className="capitalize">{row.category.replace(/_/g, " ")}</td>
                <td className="text-xs capitalize">{row.payment_method.replace(/_/g, " ")}</td>
                <td className="font-mono text-[11px] text-ink-500">{row.receipt_number ?? "—"}</td>
                <td className="text-right font-semibold tabular-nums text-emerald-700">
                  {formatMoney(row.amount, row.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  const expensesList =
    !expenses || expenses.length === 0 ? (
      <Card>
        <EmptyState
          icon={<Receipt className="h-7 w-7" />}
          title="No expenses recorded"
          description="Track utilities, salaries, outreach costs and other ministry spending."
        />
      </Card>
    ) : (
      <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-card">
        <table className="kf-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((row) => (
              <tr key={row.id}>
                <td className="text-xs">{formatDate(row.incurred_at, ctx.activeOrg.timezone)}</td>
                <td>{row.description}</td>
                <td className="text-xs capitalize">{row.category}</td>
                <td className="text-right font-semibold tabular-nums text-red-700">
                  {formatMoney(row.amount, row.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Giving & finance"
        description="Visible only to finance roles. Amounts are shown in the organization currency."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Contributions" value={formatMoney(totalIn, ctx.activeOrg.currency)} tone="gold" />
        <Stat label="Expenses" value={formatMoney(totalOut, ctx.activeOrg.currency)} />
        <Stat label="Net" value={formatMoney(totalIn - totalOut, ctx.activeOrg.currency)} />
        <Stat label="Entries" value={`${(contributions ?? []).length + (expenses ?? []).length}`} hint="last 50 each" />
      </div>

      <FinanceTabs
        contributions={contributionsList}
        expenses={expensesList}
      >
        <div className="space-y-4">
          {canManage ? (
            <>
              <Card>
                <div className="flex items-center gap-2">
                  <HandCoins className="h-4 w-4 text-emerald-600" aria-hidden />
                  <h2 className="font-display text-base font-semibold">Record contribution</h2>
                </div>
                <div className="mt-3">
                  <ContributionForm branches={(branches ?? []) as BranchRow[]} currency={ctx.activeOrg.currency} />
                </div>
              </Card>
              <Card>
                <div className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-red-600" aria-hidden />
                  <h2 className="font-display text-base font-semibold">Record expense</h2>
                </div>
                <div className="mt-3">
                  <ExpenseForm branches={(branches ?? []) as BranchRow[]} currency={ctx.activeOrg.currency} />
                </div>
              </Card>
            </>
          ) : (
            <Card>
              <p className="text-sm text-ink-500">
                Your role has read-only finance access. Ask an owner or finance officer to record entries.
              </p>
            </Card>
          )}
        </div>
      </FinanceTabs>
    </div>
  );
}
