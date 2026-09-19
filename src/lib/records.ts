import 'server-only';
import { getWorkspace } from './auth';
import type { Module } from './modules';
import type { Option } from '@/components/record-form';
export async function relationOptions(module: Module, initial?: Record<string, unknown>) {
  const { db, organization } = await getWorkspace();
  const result: Record<string, Option[]> = {};
  for (const f of module.fields.filter((f) => f.relation)) {
    const table = f.relation!;
    const name = ['members', 'visitors'].includes(table)
      ? 'first_name,last_name'
      : table === 'events'
        ? 'title'
        : 'name';
    const { data, error } = await db
      .from(table)
      .select(`id,${name}`)
      .eq('organization_id', organization.id)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw new Error('Could not load related records. Check permissions and try again.');
    const rows = data as unknown as Record<string, unknown>[];
    if (initial?.[f.key] && !rows.some((r) => r.id === initial[f.key])) {
      const { data: linked, error: linkError } = await db
        .from(table)
        .select(`id,${name}`)
        .eq('organization_id', organization.id)
        .eq('id', String(initial[f.key]))
        .maybeSingle();
      if (linkError) throw new Error('Could not load the linked record.');
      if (linked) rows.push(linked as unknown as Record<string, unknown>);
    }
    result[f.key] = rows.map((r) => ({
      id: String(r.id),
      label: r.first_name ? `${r.first_name} ${r.last_name}` : String(r.title ?? r.name),
    }));
  }
  return result;
}
