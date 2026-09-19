'use server';
import { unstable_rethrow } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import {
  organizationSchema,
  errorMessage,
  databaseError,
  type ActionResult,
} from '@/lib/validation';
export async function saveOrganization(values: unknown): Promise<ActionResult> {
  try {
    const parsed = organizationSchema.safeParse(values);
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { db, organization, user } = await requirePermission('organization.settings');
    const { administrator_name, ...org } = parsed.data;
    const { error } = await db
      .from('organizations')
      .update(org)
      .eq('id', organization.id)
      .select('id')
      .single();
    if (error) return { error: databaseError(error.code) };
    const { error: profileError } = await db
      .from('profiles')
      .upsert({ id: user.id, full_name: administrator_name });
    if (profileError)
      return { error: 'Organization saved, but your profile update failed. Please try again.' };
    revalidatePath('/app', 'layout');
    return { success: 'Organization and profile saved.' };
  } catch (error) {
    unstable_rethrow(error);
    return { error: errorMessage(error) };
  }
}
