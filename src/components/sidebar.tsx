'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  ClipboardCheck,
  Layers,
  HeartHandshake,
  CalendarDays,
  PhoneCall,
  Heart,
  HandHelping,
  Wallet,
  MessagesSquare,
  ChartNoAxesCombined,
  Sparkles,
  CreditCard,
  Settings,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Brand } from './brand';
import { LogoutButton } from './logout-button';
const links = [
  ['', 'Overview', LayoutDashboard],
  ['members', 'Members', Users],
  ['visitors', 'Visitors', UserPlus],
  ['attendance', 'Attendance', ClipboardCheck],
  ['departments', 'Departments', Layers],
  ['groups', 'Groups', HeartHandshake],
  ['events', 'Events', CalendarDays],
  ['followups', 'Follow-ups', PhoneCall],
  ['prayer-requests', 'Prayer requests', Heart],
  ['volunteers', 'Volunteers', HandHelping],
  ['contributions', 'Contributions', Wallet],
  ['communications', 'Communications', MessagesSquare],
  ['reports', 'Reports', ChartNoAxesCombined],
  ['ai', 'KingdomFlow AI', Sparkles],
  ['billing', 'Billing', CreditCard],
  ['settings', 'Settings', Settings],
] as const;
export function Sidebar({
  organization,
  role,
  email,
}: {
  organization: string;
  role: string;
  email: string;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="mobile-bar">
        <Brand />
        <button
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-expanded={open}
          aria-controls="workspace-navigation"
          className="icon-button"
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <button
          className="nav-overlay"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside id="workspace-navigation" className={`sidebar ${open ? 'is-open' : ''}`}>
        <div className="sidebar-brand">
          <Brand />
        </div>
        <div className="workspace-label">
          <span className="workspace-avatar">{organization.slice(0, 1)}</span>
          <span>
            <strong>{organization}</strong>
            <small>{role.replaceAll('_', ' ')} workspace</small>
          </span>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Workspace">
          {links.map(([slug, name, Icon]) => {
            const href = `/app${slug ? '/' + slug : ''}`;
            const active = slug ? path.startsWith(href) : path === '/app';
            return (
              <Link
                key={slug}
                href={href}
                className={`nav-item ${active ? 'active' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => setOpen(false)}
              >
                <Icon size={18} />
                <span>{name}</span>
                {slug === 'ai' && <span className="nav-ai">AI</span>}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <small title={email}>{email}</small>
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}
