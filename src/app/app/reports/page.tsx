import Link from 'next/link';
import { Download } from 'lucide-react';
import { allowed, getWorkspace } from '@/lib/auth';
import { reportRange, reportSummary } from '@/lib/reports';
import { PageHeader, PermissionState } from '@/components/states';
export default async function Reports({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  if (!(await allowed('reports.view'))) return <PermissionState />;
  const { db, organization } = await getWorkspace();
  const { data: entitlement, error } = await db.rpc('entitled', {
    organization: organization.id,
    feature: 'reports',
  });
  if (error) throw new Error('Report entitlement could not be checked.');
  if (!entitlement)
    return (
      <>
        <PageHeader
          title="Reports"
          description="Real ministry data, ready for a thoughtful review."
        />
        <div className="notice warning">
          <strong>Plan access required</strong>
          <p>
            Reports require an active Pro or Premium AI plan.{' '}
            <Link href="/app/billing">View your subscription</Link>.
          </p>
        </div>
      </>
    );
  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const start = today.slice(0, 8) + '01';
  const from = params.from ?? start;
  const to = params.to ?? today;
  const parsed = reportRange.safeParse({ from, to });
  const rows = parsed.success ? await reportSummary(from, to) : null;
  return (
    <>
      <PageHeader
        title="Reports"
        description="Date-filtered counts from your authorized organization records. Date boundaries use UTC."
      />
      <section className="panel form-panel">
        <form className="report-filter">
          <div className="field">
            <label htmlFor="from">From</label>
            <input type="date" id="from" name="from" defaultValue={from} required />
          </div>
          <div className="field">
            <label htmlFor="to">To</label>
            <input type="date" id="to" name="to" defaultValue={to} required />
          </div>
          <button className="button button-primary">Generate report</button>
        </form>
        {!parsed.success && (
          <p className="notice danger" role="alert">
            {parsed.error.issues[0].message}
          </p>
        )}
      </section>
      {rows && (
        <section className="panel section-gap">
          <div className="panel-heading">
            <h2>Activity summary</h2>
            <a
              href={`/app/reports/export?${new URLSearchParams({ from, to })}`}
              className="button button-outline button-sm"
            >
              <Download size={16} />
              Export CSV
            </a>
          </div>
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Records</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td>{r.count ?? 'Permission Required'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="form-panel muted">
            Counts describe records within the selected dates, not unique participant engagement or
            a growth percentage. Advanced attendance trends, finance aggregation, and PDF reports
            are not available in this release.
          </p>
        </section>
      )}
    </>
  );
}
