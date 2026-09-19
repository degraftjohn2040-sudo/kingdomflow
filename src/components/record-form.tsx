'use client';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveRecord } from '@/app/app/actions';
import { type Module, moduleSchema } from '@/lib/modules';
import { label } from '@/lib/utils';
import type { ActionResult } from '@/lib/validation';
import { Button } from './ui/button';
export type Option = { id: string; label: string };
export function RecordForm({
  slug,
  module,
  initial = {},
  id = null,
  options = {},
}: {
  slug: string;
  module: Module;
  initial?: Record<string, unknown>;
  id?: string | null;
  options?: Record<string, Option[]>;
}) {
  const router = useRouter();
  const defaults: Record<string, string> = {};
  for (const f of module.fields) {
    let value = initial[f.key];
    if (value === undefined && f.required)
      value =
        f.options?.[0] ??
        (f.type === 'date'
          ? new Date().toISOString().slice(0, 10)
          : f.type === 'number' && f.min === 0
            ? '0'
            : '');
    defaults[f.key] =
      f.type === 'datetime-local' && value ? String(value).slice(0, 16) : String(value ?? '');
  }
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<Record<string, string>>({ defaultValues: defaults });
  const [result, setResult] = useState<ActionResult>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <form
      className="form-stack"
      onSubmit={handleSubmit(async (values) => {
        setErrors({});
        setResult({});
        const parsed = moduleSchema(module).safeParse(values);
        if (!parsed.success) {
          setErrors(
            Object.fromEntries(parsed.error.issues.map((e) => [String(e.path[0]), e.message])),
          );
          return;
        }
        if (
          slug === 'members' &&
          values.status === 'archived' &&
          initial.status !== 'archived' &&
          !window.confirm('Archive this member? The record will be retained for history.')
        )
          return;
        try {
          const r = await saveRecord(slug, id, values);
          setResult(r);
          if (r.id) {
            router.push(`/app/${slug}/${r.id}`);
            router.refresh();
          }
        } catch {
          setResult({
            error:
              'Network error. Saving could not be confirmed. Check the record before retrying.',
          });
        }
      })}
    >
      <div className="form-grid">
        {module.fields.map((f) => (
          <div key={f.key} className={`field ${f.type === 'textarea' ? 'full' : ''}`}>
            <label htmlFor={f.key}>
              {f.label}
              {f.required && <span aria-hidden="true"> *</span>}
            </label>
            {f.relation || f.options ? (
              <select
                id={f.key}
                {...register(f.key)}
                required={f.required}
                aria-invalid={Boolean(errors[f.key])}
              >
                <option value="">{f.required ? 'Select an option' : 'None'}</option>
                {f.relation
                  ? (options[f.key] ?? []).map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))
                  : f.options?.map((o) => (
                      <option key={o} value={o}>
                        {label(o)}
                      </option>
                    ))}
              </select>
            ) : f.type === 'textarea' ? (
              <textarea
                id={f.key}
                rows={4}
                maxLength={f.max}
                required={f.required}
                {...register(f.key)}
                aria-invalid={Boolean(errors[f.key])}
              />
            ) : (
              <input
                id={f.key}
                type={f.type ?? 'text'}
                maxLength={f.type === 'number' ? undefined : f.max}
                max={f.type === 'number' ? f.max : undefined}
                min={f.type === 'number' ? f.min : undefined}
                step={f.step}
                required={f.required}
                {...register(f.key)}
                aria-invalid={Boolean(errors[f.key])}
              />
            )}{' '}
            {f.relation && (
              <small>
                Up to 200 authorized records are listed. Contact an administrator if the record you
                need is not available.
              </small>
            )}
            {errors[f.key] && (
              <small className="error" role="alert">
                {errors[f.key]}
              </small>
            )}
          </div>
        ))}
      </div>
      {result.error && (
        <div className="notice danger" role="alert">
          {result.error}
        </div>
      )}
      {result.success && (
        <div className="notice success" role="status">
          {result.success}
        </div>
      )}
      <div className="actions">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : id ? 'Save changes' : `Add ${module.singular}`}
        </Button>
        <Button variant="outline" type="button" onClick={() => router.push(`/app/${slug}`)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
