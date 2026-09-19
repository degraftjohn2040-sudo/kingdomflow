'use server';
import { unstable_rethrow } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import { getModule, moduleSchema } from '@/lib/modules';
import { databaseError, errorMessage, uuid, type ActionResult } from '@/lib/validation';
export async function saveRecord(
  slug: string,
  id: string | null,
  values: unknown,
): Promise<ActionResult> {
  try {
    const definition = getModule(slug);
    if (!definition) return { error: 'Unknown module.' };
    if (id && !uuid.safeParse(id).success) return { error: 'Invalid record identifier.' };
    const parsed = moduleSchema(definition).safeParse(values);
    if (!parsed.success)
      return {
        error: parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(' '),
      };
    const { db, organization } = await requirePermission(
      id ? definition.write : (definition.create ?? definition.write),
      definition.feature ?? 'core',
    );
    if (slug === 'members' && parsed.data.status === 'archived')
      await requirePermission('members.delete', 'core');
    const query = id
      ? db
          .from(definition.table)
          .update(parsed.data)
          .eq('id', id)
          .eq('organization_id', organization.id)
      : db.from(definition.table).insert({ ...parsed.data, organization_id: organization.id });
    const { data, error } = await query.select('id').single();
    if (error) return { error: databaseError(error.code) };
    revalidatePath('/app', 'layout');
    return { success: 'Record saved.', id: data.id };
  } catch (error) {
    unstable_rethrow(error);
    return { error: errorMessage(error) };
  }
}
export async function convertVisitor(id: string): Promise<ActionResult> {
  try {
    if (!uuid.safeParse(id).success) return { error: 'Invalid visitor identifier.' };
    const { db, organization } = await requirePermission('visitors.manage', 'core');
    await requirePermission('members.create', 'core');
    const { data, error } = await db.rpc('convert_visitor', {
      visitor: id,
      organization: organization.id,
    });
    if (error) return { error: databaseError(error.code) };
    revalidatePath('/app', 'layout');
    return { success: 'Visitor converted to a member.', id: data };
  } catch (error) {
    unstable_rethrow(error);
    return { error: errorMessage(error) };
  }
}
const attendanceSchema = z.object({
  sessionId: uuid,
  records: z
    .array(z.object({ member_id: uuid, status: z.enum(['present', 'absent']) }))
    .min(1)
    .max(100),
});
export async function recordAttendance(values: unknown): Promise<ActionResult> {
  try {
    const parsed = attendanceSchema.safeParse(values);
    if (!parsed.success) return { error: 'Choose attendance for between 1 and 100 members.' };
    if (new Set(parsed.data.records.map((r) => r.member_id)).size !== parsed.data.records.length)
      return { error: 'Duplicate members are not allowed.' };
    const { db, organization, user } = await requirePermission('attendance.manage', 'core');
    const { error } = await db.from('attendance_records').upsert(
      parsed.data.records.map((r) => ({
        ...r,
        session_id: parsed.data.sessionId,
        organization_id: organization.id,
        recorded_by: user.id,
      })),
      { onConflict: 'organization_id,session_id,member_id' },
    );
    if (error) return { error: databaseError(error.code) };
    revalidatePath('/app', 'layout');
    return { success: 'Attendance saved.' };
  } catch (error) {
    unstable_rethrow(error);
    return { error: errorMessage(error) };
  }
}
