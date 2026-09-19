'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import type { z } from 'zod';
import { organizationSchema, type ActionResult } from '@/lib/validation';
import { createWorkspace } from '@/app/onboarding/actions';
import { saveOrganization } from '@/app/app/settings/actions';
import { Button } from './ui/button';
type Values = z.infer<typeof organizationSchema>;
export function OrganizationForm({
  initial,
  settings = false,
}: {
  initial?: Partial<Values>;
  settings?: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      organization_type: 'church',
      country: 'Ghana',
      timezone: 'Africa/Accra',
      email: '',
      phone: '',
      ...initial,
    },
  });
  const [result, setResult] = useState<ActionResult>({});
  return (
    <form
      className="form-stack"
      onSubmit={handleSubmit(async (v) => {
        setResult({});
        try {
          setResult(await (settings ? saveOrganization(v) : createWorkspace(v)));
        } catch {
          setResult({ error: 'Network error. Your changes could not be confirmed.' });
        }
      })}
    >
      <div className="form-grid">
        {(
          [
            ['name', 'Organization name'],
            ['administrator_name', 'Your full name'],
            ['country', 'Country'],
            ['timezone', 'Timezone (IANA)'],
            ['email', 'Organization email'],
            ['phone', 'Organization phone'],
          ] as const
        ).map(([key, label]) => (
          <div className="field" key={key}>
            <label htmlFor={key}>{label}</label>
            <input
              id={key}
              type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
              {...register(key)}
            />
            {errors[key] && <small className="error">{errors[key]?.message}</small>}
          </div>
        ))}
        <div className="field">
          <label htmlFor="organization_type">Organization type</label>
          <select id="organization_type" {...register('organization_type')}>
            {['church', 'ministry', 'fellowship', 'campus', 'network', 'other'].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>
      {!settings && (
        <div className="notice">
          Your organization and owner membership will be created together. Your 30-day trial begins
          when this step succeeds. You can add departments afterward.
        </div>
      )}
      {result.error && (
        <p role="alert" className="notice danger">
          {result.error}
        </p>
      )}
      {result.success && (
        <p role="status" className="notice success">
          {result.success}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting
          ? 'Saving…'
          : settings
            ? 'Save organization & profile'
            : 'Create ministry workspace'}
      </Button>
    </form>
  );
}
