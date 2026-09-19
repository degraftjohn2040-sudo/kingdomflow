import { getWorkspace, allowed } from '@/lib/auth';
import { PageHeader, PermissionState, EmptyState } from '@/components/states';
import { Check, ShieldCheck } from 'lucide-react';
export default async function Billing() {
  if (!(await allowed('subscription.manage'))) return <PermissionState />;
  const { db, organization } = await getWorkspace();
  const [{ data: plans, error: planError }, { data: payments, error: paymentError }] =
    await Promise.all([
      db.from('plans').select('*').order('price_minor'),
      db
        .from('payments')
        .select('id,amount_minor,currency,provider_reference,status,created_at')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false })
        .limit(25),
    ]);
  if (planError || paymentError) throw new Error('Billing records could not be loaded.');
  return (
    <>
      <PageHeader
        title="A plan for your ministry."
        description="Clear pricing. Thoughtful tools. Choose the space your ministry needs."
      />
      <section className="panel form-panel">
        <div className="billing-current">
          <div>
            <span className="eyebrow">CURRENT SUBSCRIPTION</span>
            <h2>
              {organization.subscription_plan.replaceAll('_', ' ')}{' '}
              <span className="badge">{organization.subscription_status}</span>
            </h2>
            <p className="muted">
              Access end:{' '}
              {organization.subscription_status === 'trialing'
                ? new Date(organization.trial_ends_at).toLocaleDateString('en-GB')
                : organization.subscription_ends_at
                  ? new Date(organization.subscription_ends_at).toLocaleDateString('en-GB')
                  : 'Not activated'}
            </p>
          </div>
          <ShieldCheck size={28} />
        </div>
      </section>
      <div className="plan-grid">
        {plans?.map((p) => (
          <section key={p.id} className={`panel plan-card ${p.id === 'pro' ? 'featured' : ''}`}>
            <span className="eyebrow">{p.name}</span>
            <h2>GHS {p.price_minor / 100}</h2>
            <p className="muted">
              {p.trial_days
                ? `${p.trial_days} days`
                : `Every ${p.duration_months} month${p.duration_months > 1 ? 's' : ''}`}
            </p>
            <ul>
              {p.features.map((f: string) => (
                <li key={f}>
                  <Check size={16} />
                  {f === 'core'
                    ? 'Core ministry operations'
                    : f === 'ai'
                      ? 'AI entitlement (integration unavailable)'
                      : `${f.charAt(0).toUpperCase() + f.slice(1)} entitlement`}
                </li>
              ))}
            </ul>
            <span className="badge">
              {organization.subscription_plan === p.id ? 'Current plan' : 'Checkout unavailable'}
            </span>
          </section>
        ))}
      </div>
      <div className="notice warning">
        <strong>Payment Integration Not Connected</strong>
        <p>
          Paystack checkout, verification, webhooks, and manual Mobile Money approval are not
          enabled in this release. Adding a provider key alone does not activate them. No plan can
          be purchased or renewed from this page yet.
        </p>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2>Payment history</h2>
          <small className="muted">Most recent 25 records</small>
        </div>
        {!payments?.length ? (
          <EmptyState
            title="No payment records"
            description="Only persisted payment records are shown here. No transactions have been fabricated."
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{new Date(p.created_at).toLocaleDateString('en-GB')}</td>
                    <td>{p.provider_reference}</td>
                    <td>
                      {p.currency} {(p.amount_minor / 100).toFixed(2)}
                    </td>
                    <td>{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
