import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { OrganizationForm } from '@/components/organization-form';
import { Brand } from '@/components/brand';
export default async function Onboarding() {
  const { db, user } = await requireUser();
  const { data, error } = await db
    .from('organization_members')
    .select('status')
    .eq('user_id', user.id);
  if (error) throw new Error('Database unavailable. Apply the migrations and try again.');
  return (
    <main className="setup-page">
      <Brand />
      <div className="setup-card wide">
        <span className="eyebrow">YOUR WORKSPACE</span>
        <h1>Welcome to KingdomFlow.</h1>
        {data?.length ? (
          <div className="notice warning">
            <p>
              A workspace membership already exists. If your access is suspended, contact your
              organization owner.
            </p>
            <Link href="/app">Return to dashboard</Link>
          </div>
        ) : (
          <>
            <p className="muted">
              Tell us about your ministry. This creates your organization and initial administrator
              profile in one transaction.
            </p>
            <OrganizationForm initial={{ email: user.email ?? '' }} />
          </>
        )}
      </div>
    </main>
  );
}
