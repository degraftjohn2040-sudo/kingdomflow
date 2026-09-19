import { LockKeyhole, PlugZap, Inbox } from 'lucide-react';
export function PermissionState() {
  return (
    <section className="empty-state panel">
      <LockKeyhole />
      <h2>Permission Required</h2>
      <p>Your role does not have access to this module. Contact your organization owner.</p>
    </section>
  );
}
export function Unavailable({ title, description }: { title: string; description: string }) {
  return (
    <section className="empty-state panel">
      <PlugZap />
      <span className="badge amber">Unavailable</span>
      <h2>{title}</h2>
      <p>{description}</p>
      <p className="muted">No operation has been submitted or simulated.</p>
    </section>
  );
}
export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <Inbox />
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function PageHeader({
  eyebrow = 'YOUR WORKSPACE',
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {children && <div className="header-actions">{children}</div>}
    </header>
  );
}
