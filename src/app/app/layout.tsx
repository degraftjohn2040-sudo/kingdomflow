import { getWorkspace } from '@/lib/auth';
import { Sidebar } from '@/components/sidebar';
import { ShieldCheck } from 'lucide-react';
export const dynamic = 'force-dynamic';
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { organization, role, user } = await getWorkspace();
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Sidebar organization={organization.name} role={role} email={user.email ?? ''} />
      <div className="workspace-main">
        <div className="topbar">
          <span>Ministry management, thoughtfully connected.</span>
          <span className="secure-label">
            <ShieldCheck size={15} />
            Private workspace
          </span>
        </div>
        <main id="main-content" className="page-content">
          {children}
        </main>
        <footer className="workspace-footer">
          <span>KingdomFlow</span>
          <span>Members. Ministry. Growth. One Platform.</span>
        </footer>
      </div>
    </div>
  );
}
