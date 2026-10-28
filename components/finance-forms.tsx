"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { recordContribution, recordExpense } from "@/app/actions/finance";

type Option = { id: string; name: string };

const METHODS = [
  ["cash", "Cash"],
  ["mobile_money", "Mobile money"],
  ["bank_transfer", "Bank transfer"],
  ["card", "Card"],
  ["cheque", "Cheque"],
] as const;

export function ContributionForm({
  branches,
  currency,
}: {
  branches: Option[];
  currency: string;
}) {
  const [state, action] = useActionState(recordContribution, null);

  return (
    <form action={action} className="space-y-3">
      {state?.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={`Amount (${currency})`} htmlFor="amount" required error={state?.fieldErrors?.amount}>
          <Input id="amount" name="amount" type="number" min="0.01" step="0.01" required />
        </Field>
        <Field label="Category" htmlFor="category" required>
          <Select id="category" name="category" defaultValue="offering">
            <option value="tithe">Tithe</option>
            <option value="offering">Offering</option>
            <option value="seed">Seed</option>
            <option value="donation">Donation</option>
            <option value="pledge">Pledge</option>
            <option value="building_fund">Building fund</option>
            <option value="welfare">Welfare</option>
            <option value="other">Other</option>
          </Select>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date received" htmlFor="given_at" required>
          <Input id="given_at" name="given_at" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
        </Field>
        <Field label="Payment method" htmlFor="payment_method">
          <Select id="payment_method" name="payment_method" defaultValue="cash">
            {METHODS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {branches.length > 0 ? (
        <Field label="Branch" htmlFor="branch_id">
          <Select id="branch_id" name="branch_id" defaultValue="">
            <option value="">Organization-wide</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Field label="Reference" htmlFor="reference" hint="MoMo transaction ID, cheque number, etc.">
        <Input id="reference" name="reference" />
      </Field>
      <Field label="Notes" htmlFor="notes">
        <Textarea id="notes" name="notes" rows={2} />
      </Field>
      <SubmitButton className="w-full" pendingLabel="Recording…">
        Record contribution
      </SubmitButton>
    </form>
  );
}

export function ExpenseForm({ branches, currency }: { branches: Option[]; currency: string }) {
  const [state, action] = useActionState(recordExpense, null);

  return (
    <form action={action} className="space-y-3">
      {state?.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={`Amount (${currency})`} htmlFor="e-amount" required error={state?.fieldErrors?.amount}>
          <Input id="e-amount" name="amount" type="number" min="0.01" step="0.01" required />
        </Field>
        <Field label="Category" htmlFor="e-category" required error={state?.fieldErrors?.category}>
          <Input id="e-category" name="category" required placeholder="Utilities" />
        </Field>
      </div>
      <Field label="Description" htmlFor="description" required error={state?.fieldErrors?.description}>
        <Input id="description" name="description" required placeholder="ECG electricity bill — October" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date incurred" htmlFor="incurred_at" required>
          <Input id="incurred_at" name="incurred_at" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
        </Field>
        <Field label="Payment method" htmlFor="e-method">
          <Select id="e-method" name="payment_method" defaultValue="cash">
            {METHODS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {branches.length > 0 ? (
        <Field label="Branch" htmlFor="e-branch">
          <Select id="e-branch" name="branch_id" defaultValue="">
            <option value="">Organization-wide</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <SubmitButton className="w-full" variant="secondary" pendingLabel="Recording…">
        Record expense
      </SubmitButton>
    </form>
  );
}

export function FinanceTabs({
  children,
  contributions,
  expenses,
}: {
  children: React.ReactNode;
  contributions: React.ReactNode;
  expenses: React.ReactNode;
}) {
  const [tab, setTab] = useState<"contributions" | "expenses">("contributions");
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="mb-3 flex gap-2 text-xs">
          <button
            onClick={() => setTab("contributions")}
            className={`rounded-full px-3 py-1.5 font-semibold ${tab === "contributions" ? "bg-ink-900 text-white" : "border border-ink-300 text-ink-600"}`}
          >
            Contributions
          </button>
          <button
            onClick={() => setTab("expenses")}
            className={`rounded-full px-3 py-1.5 font-semibold ${tab === "expenses" ? "bg-ink-900 text-white" : "border border-ink-300 text-ink-600"}`}
          >
            Expenses
          </button>
        </div>
        {tab === "contributions" ? contributions : expenses}
      </div>
      {children}
    </div>
  );
}

export function NewEntryToggle({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Record entry
      </Button>
    );
  }
  return <>{children}</>;
}
