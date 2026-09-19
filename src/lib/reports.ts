import 'server-only';
import { z } from 'zod';
import { getWorkspace, allowed } from './auth';
export const reportRange = z
  .object({ from: z.iso.date(), to: z.iso.date() })
  .refine(
    (v) => v.from <= v.to && (Date.parse(v.to) - Date.parse(v.from)) / 86400000 <= 366,
    'Choose a date range of no more than 366 days.',
  );
export async function reportSummary(from: string, to: string) {
  const { db, organization } = await getWorkspace();
  const items = [
    ['New members', 'members', 'members.read', 'created_at'],
    ['Visitors registered', 'visitors', 'visitors.read', 'first_visit_date'],
    ['Attendance sessions', 'attendance_sessions', 'attendance.read', 'session_date'],
    ['Follow-ups created', 'followups', 'followups.read', 'created_at'],
    ['Events starting', 'events', 'events.read', 'starts_at'],
    ['Volunteers registered', 'volunteers', 'volunteers.read', 'created_at'],
  ] as const;
  return Promise.all(
    items.map(async ([name, table, permission, column]) => {
      if (!(await allowed(permission))) return { name, count: null };
      const timestamp = column.endsWith('_at');
      let q = db
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organization.id)
        .gte(column, timestamp ? `${from}T00:00:00Z` : from);
      q = timestamp
        ? q.lt(column, new Date(Date.parse(to) + 86400000).toISOString())
        : q.lte(column, to);
      const { count, error } = await q;
      if (error) throw new Error('Report generation failed. Database data could not be read.');
      return { name, count: count ?? 0 };
    }),
  );
}
