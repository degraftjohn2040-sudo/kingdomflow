"use client";

import { useActionState } from "react";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { updateOrganization, updateProfile } from "@/app/actions/settings";
import type { Organization } from "@/lib/types";

export function OrganizationSettingsForm({ org, canManage }: { org: Organization; canManage: boolean }) {
  const [state, action] = useActionState(updateOrganization, null);

  return (
    <form action={action} className="space-y-4">
      {state?.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}
      <fieldset disabled={!canManage} className="space-y-4 disabled:opacity-70">
        <Field label="Organization name" htmlFor="name" required error={state?.fieldErrors?.name}>
          <Input id="name" name="name" defaultValue={org.name} required />
        </Field>
        <Field label="Description" htmlFor="description">
          <Textarea id="description" name="description" defaultValue={org.description ?? ""} rows={2} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" htmlFor="phone">
            <Input id="phone" name="phone" defaultValue={org.phone ?? ""} />
          </Field>
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" defaultValue={org.email ?? ""} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Website" htmlFor="website">
            <Input id="website" name="website" defaultValue={org.website ?? ""} />
          </Field>
          <Field label="City" htmlFor="city">
            <Input id="city" name="city" defaultValue={org.city ?? ""} />
          </Field>
        </div>
        <Field label="Address" htmlFor="address">
          <Input id="address" name="address" defaultValue={org.address ?? ""} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Currency" htmlFor="currency" hint="Used for all financial records">
            <Select id="currency" name="currency" defaultValue={org.currency}>
              {["GHS", "NGN", "USD", "GBP", "EUR", "KES", "ZAR"].map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Timezone" htmlFor="timezone" hint="All timestamps are displayed in this timezone">
            <Select id="timezone" name="timezone" defaultValue={org.timezone}>
              {["Africa/Accra", "Africa/Lagos", "Africa/Abidjan", "Africa/Nairobi", "Africa/Johannesburg", "Europe/London"].map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {canManage ? <SubmitButton pendingLabel="Saving…">Save settings</SubmitButton> : null}
      </fieldset>
      {!canManage ? (
        <p className="text-xs text-ink-500">Only owners and administrators can change organization settings.</p>
      ) : null}
    </form>
  );
}

export function ProfileForm({ fullName, phone }: { fullName: string; phone: string }) {
  const [state, action] = useActionState(updateProfile, null);
  return (
    <form action={action} className="space-y-4">
      {state?.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}
      <Field label="Full name" htmlFor="fullName" error={state?.fieldErrors?.fullName}>
        <Input id="fullName" name="fullName" defaultValue={fullName} />
      </Field>
      <Field label="Phone" htmlFor="phone">
        <Input id="phone" name="phone" defaultValue={phone} />
      </Field>
      <SubmitButton variant="secondary" pendingLabel="Saving…">
        Save profile
      </SubmitButton>
    </form>
  );
}
