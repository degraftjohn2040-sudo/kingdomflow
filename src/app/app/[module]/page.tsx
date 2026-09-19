import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Plus, Search, ArrowUpRight } from 'lucide-react';
import { getModule } from '@/lib/modules';
import { allowed, getWorkspace } from '@/lib/auth';
import { label, safeSearch } from '@/lib/utils';
import { EmptyState, PageHeader, PermissionState } from '@/components/states';
import { Button } from '@/components/ui/button';
export default async function ModulePage({
  params,
  searchParams,
}: {
  params: Promise<{ module: string }>;
  searchParams: Promise<{ q?: string; page?: string; status?: string }>;
}) {
  const { module: slug } = await params;
  const definition = getModule(slug);
  if (!definition) notFound();
  if (!(await allowed(definition.read))) return <PermissionState />;
  const { db, organization } = await getWorkspace();
  const query = await searchParams;
  const page = Math.max(1, Math.min(10000, Number.parseInt(query.page ?? '1', 10) || 1));
  const q = safeSearch(query.q ?? '');
  let request = db
    .from(definition.table)
    .select(`id,${definition.columns.join(',')}`, { count: 'exact' })
    .eq('organization_id', organization.id)
    .order('created_at', { ascending: false })
    .order('id')
    .range((page - 1) * 25, page * 25 - 1);
  if (q) request = request.or(definition.search.map((key) => `${key}.ilike.%${q}%`).join(','));
  if (query.status && definition.status?.includes(query.status))
    request = request.eq('status', query.status);
  const { data, error, count } = await request;
  if (error)
    throw new Error(
      'Records could not be loaded. Check your database configuration and try again.',
    );
  const rows = data as unknown as Record<string, unknown>[];
  const relationLabels: Record<string, string> = {};
  for (const field of definition.fields.filter(
    (f) => f.relation && definition.columns.includes(f.key),
  )) {
    const ids = rows.map((r) => r[field.key]).filter((v): v is string => typeof v === 'string');
    if (!ids.length) continue;
    const columns =
      field.relation === 'members' || field.relation === 'visitors'
        ? 'id,first_name,last_name'
        : field.relation === 'events'
          ? 'id,title'
          : 'id,name';
    const { data: linked, error: linkedError } = await db
      .from(field.relation!)
      .select(columns)
      .eq('organization_id', organization.id)
      .in('id', ids);
    if (linkedError) throw new Error('Related record labels could not be loaded.');
    for (const item of linked as unknown as Record<string, unknown>[]) {
      relationLabels[String(item.id)] = item.first_name
        ? `${item.first_name} ${item.last_name}`
        : String(item.name ?? item.title);
    }
  }
  const display = (value: unknown) =>
    typeof value === 'string' ? (relationLabels[value] ?? value) : String(value ?? '—');
  const canWrite = await allowed(definition.create ?? definition.write);
  const link = (p: number) =>
    `/app/${slug}?${new URLSearchParams({ q, page: String(p), ...(query.status ? { status: query.status } : {}) })}`;
  return (
    <>
      <PageHeader title={definition.title} description={definition.description}>
        {canWrite && (
          <Button asChild>
            <Link href={`/app/${slug}/new`}>
              <Plus size={17} />
              Add {definition.singular}
            </Link>
          </Button>
        )}
      </PageHeader>
      {definition.feature && (
        <div className="notice">
          This module requires an active plan with {definition.feature} access.{' '}
          <Link href="/app/billing">View billing</Link>.
        </div>
      )}
      <section className="panel">
        <div className="table-toolbar">
          <div>
            <h2>All {definition.title.toLowerCase()}</h2>
            <span className="muted">
              {count ?? 0} {count === 1 ? 'record' : 'records'}
            </span>
          </div>
          <form className="search-form">
            <div className="search-input">
              <Search size={16} />
              <input
                aria-label={`Search ${definition.title.toLowerCase()}`}
                name="q"
                placeholder={`Search ${definition.title.toLowerCase()}…`}
                defaultValue={q}
                maxLength={100}
              />
            </div>
            {definition.status && (
              <select name="status" aria-label="Filter by status" defaultValue={query.status ?? ''}>
                <option value="">All statuses</option>
                {definition.status.map((s) => (
                  <option key={s} value={s}>
                    {label(s)}
                  </option>
                ))}
              </select>
            )}
            <Button type="submit" variant="outline" size="sm">
              Filter
            </Button>
          </form>
        </div>
        {!rows.length ? (
          <EmptyState
            title={
              q || query.status ? 'No matching records' : `No ${definition.title.toLowerCase()} yet`
            }
            description={
              q || query.status
                ? 'Try a different search or clear the filters.'
                : `Add your first ${definition.singular} to get started.`
            }
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {definition.columns.map((c) => (
                    <th key={c}>{label(c.replace('_id', ''))}</th>
                  ))}
                  <th>
                    <span className="sr-only">View record</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={String(row.id)}>
                    {definition.columns.map((c, i) => (
                      <td key={c}>
                        {i === 0 ? (
                          <Link className="record-link" href={`/app/${slug}/${row.id}`}>
                            {display(row[c])}
                          </Link>
                        ) : c === 'status' || c === 'confidentiality' ? (
                          <span
                            className={`badge ${row[c] === 'active' || row[c] === 'answered' ? 'green' : ''}`}
                          >
                            {label(String(row[c] ?? '—'))}
                          </span>
                        ) : c.endsWith('_at') ? (
                          new Date(String(row[c])).toLocaleString('en-GB', { timeZone: 'UTC' })
                        ) : (
                          String(row[c] ?? '—')
                        )}
                      </td>
                    ))}
                    <td>
                      <Link
                        className="icon-button"
                        href={`/app/${slug}/${row.id}`}
                        aria-label={`View ${definition.singular}`}
                      >
                        <ArrowUpRight size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="pagination">
          <span>
            Page {page} of {Math.max(1, Math.ceil((count ?? 0) / 25))} · 25 per page
          </span>
          <div>
            {page > 1 && (
              <Link className="button button-outline button-sm" href={link(page - 1)}>
                Previous
              </Link>
            )}
            {page * 25 < (count ?? 0) && (
              <Link className="button button-outline button-sm" href={link(page + 1)}>
                Next
              </Link>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
