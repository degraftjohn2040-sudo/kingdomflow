import Link from 'next/link';
import { Brand } from '@/components/brand';
import { ShieldCheck, Database, ArrowRight } from 'lucide-react';
export default function Configuration() {
  return (
    <main className="setup-page">
      <Brand />
      <div className="setup-card">
        <span className="icon-tile">
          <Database />
        </span>
        <span className="badge amber">Configuration Required</span>
        <h1>Connect your ministry’s foundation.</h1>
        <p className="muted">
          KingdomFlow needs a configured Supabase project before you can sign in or manage ministry
          records. No sample data or simulated operations are used.
        </p>
        <ol className="setup-steps">
          <li>
            <strong>Connect Supabase</strong>
            <p>Set the public project URL and anon key in your deployment environment.</p>
          </li>
          <li>
            <strong>Apply database migrations</strong>
            <p>
              Apply the versioned migrations in <code>supabase/migrations</code> to enable tenant
              isolation, permissions, and storage policies.
            </p>
          </li>
          <li>
            <strong>Configure authentication</strong>
            <p>
              Set the canonical app URL, allowed auth callback URLs, and production email delivery.
            </p>
          </li>
        </ol>
        <div className="notice">
          <ShieldCheck size={20} />
          <span>Secret keys stay on the server. Database policies protect each organization.</span>
        </div>
        <p className="muted">
          Deployment instructions are in <code>docs/DEPLOYMENT.md</code>.
        </p>
        <Link className="button button-outline" href="/login">
          Return to sign in <ArrowRight size={16} />
        </Link>
      </div>
    </main>
  );
}
