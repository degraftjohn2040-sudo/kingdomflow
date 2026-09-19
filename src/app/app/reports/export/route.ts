import { NextRequest, NextResponse } from 'next/server';
import { unstable_rethrow } from 'next/navigation';
import { allowed, getWorkspace } from '@/lib/auth';
import { reportRange, reportSummary } from '@/lib/reports';
import { csvCell } from '@/lib/utils';
export async function GET(request: NextRequest) {
  try {
    const { db, organization } = await getWorkspace();
    if (!(await allowed('reports.view')))
      return NextResponse.json({ error: 'Permission Required' }, { status: 403 });
    const { data, error } = await db.rpc('entitled', {
      organization: organization.id,
      feature: 'reports',
    });
    if (error)
      return NextResponse.json({ error: 'Subscription verification failed' }, { status: 503 });
    if (!data) return NextResponse.json({ error: 'Plan access required' }, { status: 403 });
    const parsed = reportRange.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success)
      return NextResponse.json(
        { error: 'Invalid report date range (maximum 366 days)' },
        { status: 400 },
      );
    const { from, to } = parsed.data;
    const rows = await reportSummary(from, to);
    const csv = [
      ['Metric', 'Records', 'From (UTC)', 'To (UTC)'],
      ...rows.map((r) => [r.name, r.count ?? 'Permission Required', from, to]),
    ]
      .map((row) => row.map(csvCell).join(','))
      .join('\r\n');
    return new NextResponse('\uFEFF' + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="kingdomflow-summary-${from}-${to}.csv"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    unstable_rethrow(error);
    return NextResponse.json({ error: 'Report generation failed' }, { status: 503 });
  }
}
