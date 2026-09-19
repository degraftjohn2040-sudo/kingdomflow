import Link from 'next/link';
import {
  Users,
  UserPlus,
  ClipboardCheck,
  PhoneCall,
  ArrowUpRight,
  CalendarDays,
  Plus,
  ArrowRight,
  Leaf,
} from 'lucide-react';
import { allowed, getWorkspace } from '@/lib/auth';
import { PageHeader, EmptyState } from '@/components/states';
import { Button } from '@/components/ui/button';
export default async function Overview() {
  const { db, organization } = await getWorkspace();
  async function count(table: string, permission: string, filter?: [string, string]) {
    if (!(await allowed(permission))) return null;
    let q = db
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organization.id);
    if (filter) q = q.eq(...filter);
    const { count, error } = await q;
    if (error)
      throw new Error('Dashboard data could not be loaded. No metrics have been substituted.');
    return count ?? 0;
  }
  const [members, active, visitors, present, marked, followups, departments, groups, volunteers] =
    await Promise.all([
      count('members', 'members.read'),
      count('members', 'members.read', ['status', 'active']),
      count('visitors', 'visitors.read'),
      count('attendance_records', 'attendance.read', ['status', 'present']),
      count('attendance_records', 'attendance.read'),
      count('followups', 'followups.read', ['status', 'required']),
      count('departments', 'departments.read', ['status', 'active']),
      count('groups', 'groups.read', ['status', 'active']),
      count('volunteers', 'volunteers.read', ['status', 'active']),
    ]);
  const eventAccess = await allowed('events.read');
  const { data: events, error } = eventAccess
    ? await db
        .from('events')
        .select('id,title,starts_at,venue')
        .eq('organization_id', organization.id)
        .eq('status', 'scheduled')
        .gte('starts_at', new Date().toISOString())
        .order('starts_at')
        .limit(4)
    : { data: [], error: null };
  if (error) throw new Error('Upcoming events could not be loaded.');
  const end =
    organization.subscription_status === 'trialing'
      ? organization.trial_ends_at
      : organization.subscription_ends_at;
  const expired =
    !end ||
    new Date(end) <= new Date() ||
    ['expired', 'cancelled'].includes(organization.subscription_status);
  const metrics = [
    {
      title: 'Total members',
      value: members,
      detail: active === null ? 'Permission required' : `${active} active members`,
      icon: Users,
      href: 'members',
      color: 'purple',
    },
    {
      title: 'Visitors',
      value: visitors,
      detail: 'People welcomed into your community',
      icon: UserPlus,
      href: 'visitors',
      color: 'orange',
    },
    {
      title: 'Attendance rate',
      value:
        marked === null ? null : marked ? `${Math.round(((present ?? 0) / marked) * 100)}%` : '—',
      detail: marked ? 'Present ÷ all explicitly marked records' : 'No attendance recorded yet',
      icon: ClipboardCheck,
      href: 'attendance',
      color: 'blue',
    },
    {
      title: 'Follow-up required',
      value: followups,
      detail: 'Records in the Follow-up Required stage',
      icon: PhoneCall,
      href: 'followups',
      color: 'green',
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow="MINISTRY AT A GLANCE"
        title="Your ministry, in focus."
        description={`Welcome to ${organization.name}. Here’s what’s happening in your workspace.`}
      >
        {(await allowed('members.create')) && (
          <Button asChild>
            <Link href="/app/members/new">
              <Plus size={17} />
              Add member
            </Link>
          </Button>
        )}
      </PageHeader>
      <div className={`workspace-banner ${expired ? 'expired' : ''}`}>
        <span className="banner-symbol">
          <Leaf size={22} />
        </span>
        <div>
          <strong>
            {expired
              ? 'Your workspace needs an active subscription'
              : organization.subscription_plan === 'trial'
                ? 'A new chapter for your ministry'
                : 'Room for your ministry to grow'}
          </strong>
          <p>
            {expired
              ? 'Existing records remain available to authorized readers. New operational writes are restricted.'
              : `Your ${organization.subscription_plan.replaceAll('_', ' ')} access runs until ${new Date(end).toLocaleDateString('en-GB', { timeZone: organization.timezone })}. Make every connection count.`}
          </p>
        </div>
        <Link href="/app/billing">
          View plan <ArrowRight size={16} />
        </Link>
      </div>
      <div className="metric-grid">
        {metrics.map(({ title, value, detail, icon: Icon, href, color }) => (
          <article className="metric-card" key={title}>
            <div className="metric-top">
              <span>{title}</span>
              <span className={`metric-icon ${color}`}>
                <Icon size={19} />
              </span>
            </div>
            <strong className="metric-value">{value ?? 'Restricted'}</strong>
            <div className="metric-bottom">
              <small>{value === null ? 'Permission required' : detail}</small>
              <Link href={`/app/${href}`} aria-label={`View ${title.toLowerCase()}`}>
                <ArrowUpRight size={16} />
              </Link>
            </div>
          </article>
        ))}
      </div>
      <div className="overview-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Your community</h2>
              <p className="muted">Active teams and people, from your records</p>
            </div>
            <span className="icon-tile small">
              <Users size={19} />
            </span>
          </div>
          <div className="community-grid">
            {[
              ['Departments', departments, 'departments'],
              ['Groups', groups, 'groups'],
              ['Volunteers', volunteers, 'volunteers'],
            ].map(([name, value, href]) => (
              <Link href={`/app/${href}`} key={name}>
                <strong>{value ?? '—'}</strong>
                <span>{name}</span>
                <ArrowUpRight size={15} />
              </Link>
            ))}
          </div>
          {members === 0 ? (
            <EmptyState
              title="A community starts with one connection."
              description="Add your first member, then organize departments and groups around the way your ministry works."
            />
          ) : (
            <div className="community-note">
              <span className="status-dot" />
              <p>
                These totals reflect saved records in this organization. No sample records are
                included.
              </p>
            </div>
          )}
          <div className="panel-bottom">
            <Link href="/app/members">
              Explore your member directory <ArrowRight size={16} />
            </Link>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Upcoming events</h2>
              <p className="muted">The next moments to gather</p>
            </div>
            <CalendarDays size={20} className="muted" />
          </div>
          {!eventAccess ? (
            <p className="form-panel muted">Permission Required</p>
          ) : !events?.length ? (
            <EmptyState
              title="No upcoming events"
              description="Your scheduled gatherings will appear here."
            />
          ) : (
            <div className="event-list">
              {events.map((e) => (
                <Link key={e.id} href={`/app/events/${e.id}`}>
                  <div className="event-date">
                    <span>
                      {new Date(e.starts_at).toLocaleDateString('en-GB', {
                        month: 'short',
                        timeZone: organization.timezone,
                      })}
                    </span>
                    <strong>
                      {new Date(e.starts_at).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        timeZone: organization.timezone,
                      })}
                    </strong>
                  </div>
                  <div>
                    <strong>{e.title}</strong>
                    <small>{e.venue || 'Venue not specified'}</small>
                  </div>
                  <ArrowUpRight size={16} />
                </Link>
              ))}
            </div>
          )}
          <div className="panel-bottom">
            <Link href="/app/events">
              View all events <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </div>
      <section className="quick-start">
        <div>
          <span className="eyebrow">A LITTLE LESS ADMIN. A LITTLE MORE MINISTRY.</span>
          <h2>Keep your next step simple.</h2>
        </div>
        <div>
          <Link href="/app/visitors/new">
            <UserPlus size={20} />
            <span>Welcome a visitor</span>
            <ArrowUpRight size={16} />
          </Link>
          <Link href="/app/attendance/new">
            <ClipboardCheck size={20} />
            <span>Record attendance</span>
            <ArrowUpRight size={16} />
          </Link>
          <Link href="/app/followups/new">
            <PhoneCall size={20} />
            <span>Plan a follow-up</span>
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </section>
    </>
  );
}
