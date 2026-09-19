import { getWorkspace, allowed } from '@/lib/auth';
import { OrganizationForm } from '@/components/organization-form';
import { PageHeader, PermissionState } from '@/components/states';
import Link from 'next/link';
export default async function Settings() {
  if (!(await allowed('organization.settings'))) return <PermissionState />;
  const { db, organization, user } = await getWorkspace();
  const { data: profile, error } = await db
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw new Error('Profile could not be loaded.');
  const { data: logs, error: logError } = await db
    .from('audit_logs')
    .select('id,action,resource_type,created_at')
    .eq('organization_id', organization.id)
    .order('created_at', { ascending: false })
    .limit(20);
  if (logError) throw new Error('Audit records could not be loaded.');
  return (
    <>
      <PageHeader
        title="Workspace settings"
        description="The details that make this space yours."
      />
      <section className="panel form-panel">
        <h2>Organization & administrator</h2>
        <OrganizationForm
          settings
          initial={{
            name: organization.name,
            organization_type: organization.organization_type,
            country: organization.country,
            timezone: organization.timezone,
            email: organization.email ?? '',
            phone: organization.phone ?? '',
            administrator_name: profile?.full_name ?? '',
          }}
        />
      </section>
      <section className="panel form-panel section-gap">
        <h2>Account security</h2>
        <p className="muted">
          Signed in as {user.email}. Password changes are handled by Supabase Authentication.
        </p>
        <Link className="button button-outline" href="/update-password">
          Change password
        </Link>
      </section>
      <div className="notice warning">
        <strong>Staff administration & uploads unavailable</strong>
        <p>
          Staff invitation, role changes, ownership transfer, avatar/logo uploads, and workspace
          switching are not enabled yet. Roles cannot be changed through a client request.
        </p>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2>Recent audit activity</h2>
          <small>Last 20 changes</small>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Time (UTC)</th>
                <th>Action</th>
                <th>Resource</th>
              </tr>
            </thead>
            <tbody>
              {logs?.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.created_at).toLocaleString('en-GB', { timeZone: 'UTC' })}</td>
                  <td>{log.action}</td>
                  <td>{log.resource_type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!logs?.length && <p className="form-panel muted">No audit activity recorded.</p>}
      </section>
    </>
  );
}
