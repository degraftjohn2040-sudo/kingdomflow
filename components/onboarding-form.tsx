"use client";

import { useActionState, useMemo } from "react";
import { Alert, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { createWorkspace } from "@/app/actions/workspace";

const TIMEZONES = [
  "Africa/Accra",
  "Africa/Lagos",
  "Africa/Abidjan",
  "Africa/Nairobi",
  "Africa/Johannesburg",
  "Africa/Cairo",
  "Europe/London",
  "America/New_York",
];

const CURRENCIES = ["GHS", "NGN", "USD", "GBP", "EUR", "KES", "ZAR"];

export function OnboardingForm({ defaultName, defaultEmail }: { defaultName: string; defaultEmail: string }) {
  const [state, action] = useActionState(createWorkspace, null);
  // Stable across retries so a double submit cannot create two workspaces.
  const requestKey = useMemo(() => crypto.randomUUID(), []);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="requestKey" value={requestKey} />
      {state?.message && !state.ok ? <Alert tone="danger">{state.message}</Alert> : null}

      <fieldset className="space-y-4">
        <legend className="mb-2 font-display text-lg font-semibold">Your organization</legend>
        <Field label="Church or ministry name" htmlFor="name" required error={state?.fieldErrors?.name}>
          <Input id="name" name="name" required placeholder="Grace Chapel International" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type" htmlFor="organizationType" required>
            <Select id="organizationType" name="organizationType" defaultValue="church">
              <option value="church">Church</option>
              <option value="fellowship">Campus fellowship</option>
              <option value="ministry">Ministry</option>
              <option value="network">Church network / denomination</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Denomination" htmlFor="denomination" hint="Optional">
            <Input id="denomination" name="denomination" placeholder="e.g. Assemblies of God" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Main branch name" htmlFor="branchName" hint="Defaults to Main Campus">
            <Input id="branchName" name="branchName" placeholder="Main Campus" />
          </Field>
          <Field label="City" htmlFor="city" hint="Optional">
            <Input id="city" name="city" placeholder="Cape Coast" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Country" htmlFor="country" required hint="Two-letter code, e.g. GH">
            <Input id="country" name="country" required defaultValue="GH" maxLength={2} />
          </Field>
          <Field label="Timezone" htmlFor="timezone" required>
            <Select id="timezone" name="timezone" defaultValue="Africa/Accra">
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Currency" htmlFor="currency" required>
            <Select id="currency" name="currency" defaultValue="GHS">
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Organization phone" htmlFor="phone" hint="Optional">
            <Input id="phone" name="phone" placeholder="+233 …" />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t border-ink-200 pt-6">
        <legend className="font-display text-lg font-semibold">Your administrator profile</legend>
        <Field label="Full name" htmlFor="fullName" required error={state?.fieldErrors?.fullName}>
          <Input id="fullName" name="fullName" required defaultValue={defaultName} />
        </Field>
        <Field label="Contact email" htmlFor="email" hint={`Sign-in email: ${defaultEmail}`}>
          <Input id="email" name="email" type="email" placeholder="office@church.org" />
        </Field>
      </fieldset>

      <fieldset className="space-y-4 border-t border-ink-200 pt-6">
        <legend className="font-display text-lg font-semibold">Departments to start with</legend>
        <Field
          label="Departments"
          htmlFor="departments"
          hint="Comma separated, up to 20. You can add more later — e.g. Choir, Ushering, Youth, Welfare"
        >
          <Input id="departments" name="departments" placeholder="Choir, Ushering, Youth, Welfare" />
        </Field>
      </fieldset>

      <div className="rounded-lg bg-ink-50 p-4 text-xs leading-relaxed text-ink-500">
        Your workspace starts on the <strong>Free plan</strong>: up to 500 member records, 1 branch and 3 staff
        accounts. You can upgrade at any time from Settings.
      </div>

      <SubmitButton size="lg" className="w-full" pendingLabel="Creating your workspace…">
        Create workspace
      </SubmitButton>
    </form>
  );
}
