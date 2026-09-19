import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getModule } from '@/lib/modules';
import { allowed, getWorkspace } from '@/lib/auth';
import { relationOptions } from '@/lib/records';
import { uuid } from '@/lib/validation';
import { label, safeSearch } from '@/lib/utils';
import { RecordForm } from '@/components/record-form';
import { PageHeader, PermissionState } from '@/components/states';
import { ConvertVisitor } from '@/components/convert-visitor';
import { AttendanceRegister } from '@/components/attendance-register';
export default async function RecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ module: string; id: string }>;
  searchParams: Promise<{ saved?: string; q?: string; page?: string }>;
}) {
  const { module: slug, id } = await params;
  const definition = getModule(slug);
  if (!definition || !uuid.safeParse(id).success) notFound();
  if (!(await allowed(definition.read))) return <PermissionState />;
  const { db, organization } = await getWorkspace();
  const { data: record, error } = await db
    .from(definition.table)
    .select('*')
    .eq('id', id)
    .eq('organization_id', organization.id)
    .maybeSingle();
  if (error) throw new Error('Record could not be loaded.');
  if (!record) notFound();
  const canEdit = await allowed(definition.write);
  const options = canEdit ? await relationOptions(definition, record) : {};
  const search = await searchParams;
  let attendance: React.ReactNode = null;
  if (slug === 'attendance' && canEdit) {
    const page = Math.max(1, Math.min(10000, parseInt(search.page ?? '1') || 1));
    const q = safeSearch(search.q ?? '');
    let query = db
      .from('members')
      .select('id,first_name,last_name', { count: 'exact' })
      .eq('organization_id', organization.id)
      .eq('status', 'active')
      .order('last_name')
      .order('id')
      .range((page - 1) * 50, page * 50 - 1);
    if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`);
    if (record.group_id) query = query.eq('group_id', record.group_id);
    if (record.department_id) query = query.eq('department_id', record.department_id);
    const { data: members, error: membersError, count } = await query;
    if (membersError) throw new Error('Attendance roster could not be loaded.');
    const { data: records, error: recordsError } = members?.length
      ? await db
          .from('attendance_records')
          .select('member_id,status')
          .eq('organization_id', organization.id)
          .eq('session_id', id)
          .in(
            'member_id',
            members.map((m) => m.id),
          )
      : { data: [], error: null };
    if (recordsError) throw new Error('Saved attendance could not be loaded.');
    const base = `/app/attendance/${id}?q=${encodeURIComponent(q)}&page=`;
    attendance = (
      <section className="panel section-gap">
        <div className="table-toolbar">
          <div>
            <h2>Attendance register</h2>
            <p className="muted">{count ?? 0} active members in this roster</p>
          </div>
          <form className="search-form">
            <input
              aria-label="Search roster"
              name="q"
              defaultValue={q}
              placeholder="Search members…"
            />
            <button className="button button-outline button-sm">Search</button>
          </form>
        </div>
        <AttendanceRegister
          key={`${id}-${page}-${q}`}
          sessionId={id}
          members={members ?? []}
          existing={Object.fromEntries((records ?? []).map((r) => [r.member_id, r.status]))}
        />
        <div className="pagination">
          <span>Page {page} · 50 members per page</span>
          <div>
            {page > 1 && <Link href={`${base}${page - 1}`}>Previous</Link>}
            {page * 50 < (count ?? 0) && <Link href={`${base}${page + 1}`}>Next</Link>}
          </div>
        </div>
      </section>
    );
  }
  return (
    <>
      <Link className="back-link" href={`/app/${slug}`}>
        ← Back to {definition.title.toLowerCase()}
      </Link>
      <PageHeader
        title={
          record.first_name
            ? `${record.first_name} ${record.last_name}`
            : (record.title ?? record.name ?? `View ${definition.singular}`)
        }
        description={`Created ${new Date(record.created_at).toLocaleDateString('en-GB', { timeZone: 'UTC' })} · ${definition.singular} record`}
      >
        {slug === 'visitors' &&
          !record.converted_member_id &&
          canEdit &&
          (await allowed('members.create')) && <ConvertVisitor id={id} />}
      </PageHeader>
      {record.converted_member_id && (
        <p className="notice">
          Converted to member.{' '}
          <Link href={`/app/members/${record.converted_member_id}`}>View member profile</Link>.
        </p>
      )}
      <section className="panel form-panel">
        {canEdit ? (
          <RecordForm
            key={record.updated_at}
            slug={slug}
            id={id}
            module={definition}
            initial={record}
            options={options}
          />
        ) : (
          <dl className="detail-grid">
            {definition.fields.map((f) => (
              <div key={f.key}>
                <dt>{f.label}</dt>
                <dd>
                  {f.options
                    ? label(String(record[f.key] ?? 'Not provided'))
                    : String(record[f.key] ?? 'Not provided')}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>
      {attendance}
    </>
  );
}
