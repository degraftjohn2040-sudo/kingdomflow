'use server';
import { redirect, unstable_rethrow } from 'next/navigation';
import { cookies } from 'next/headers';
import { requireUser } from '@/lib/auth';
import {
  organizationSchema,
  databaseError,
  errorMessage,
  type ActionResult,
} from '@/lib/validation';
export async function createWorkspace(values: unknown): Promise<ActionResult> {
  try {
    const parsed = organizationSchema.safeParse(values);
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { db } = await requireUser();
    const v = parsed.data;
    const { data, error } = await db.rpc('create_organization', {
      org_name: v.name,
      org_type: v.organization_type,
      org_country: v.country,
      org_timezone: v.timezone,
      contact_email: v.email || null,
      contact_phone: v.phone || null,
      administrator_name: v.administrator_name,
    });
    if (error)
      return {
        error:
          databaseError(error.code) +
          ' If you already belong to a workspace, return to your dashboard. Email verification is required.',
      };
    (await cookies()).set('kf-workspace', data, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
  } catch (error) {
    unstable_rethrow(error);
    return { error: errorMessage(error) };
  }
  redirect('/app');
}
