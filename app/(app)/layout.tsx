import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { signOut } from "@/app/actions/auth";
import { SidebarNav, type NavItem } from "@/components/sidebar-nav";
import { OrgSwitcher } from "@/components/org-switcher";
import { initials } from "@/lib/utils";

const NAV: Array<NavItem & { permission: string }> = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", permission: "org.view" },
  { href: "/members", label: "Members", icon: "members", permission: "member.view" },
  { href: "/attendance", label: "Attendance", icon: "attendance", permission: "attendance.view" },
  { href: "/events", label: "Events", icon: "events", permission: "event.view" },
  { href: "/giving", label: "Giving", icon: "giving", permission: "finance.view" },
  { href: "/departments", label: "Departments", icon: "departments", permission: "department.view" },
  { href: "/branches", label: "Branches", icon: "branches", permission: "branch.view" },
  { href: "/visitors", label: "Visitors", icon: "visitors", permission: "visitor.view" },
  { href: "/followups", label: "Follow-ups", icon: "followups", permission: "followup.view" },
  { href: "/reports", label: "Reports", icon: "reports", permission: "report.view" },
  { href: "/team", label: "Team", icon: "team", permission: "staff.view" },
  { href: "/audit", label: "Audit log", icon: "audit", permission: "org.audit_logs" },
  { href: "/settings", label: "Settings", icon: "settings", permission: "org.view" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAuth();
  if (!ctx.activeOrg) redirect("/onboarding");

  const items = NAV.filter((item) => ctx.permissions.includes(item.permission)).map(
    ({ href, label, icon }) => ({ href, label, icon }),
  );

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="no-print hidden w-64 shrink-0 flex-col bg-ink-950 lg:flex">
        <div className="px-5 pb-4 pt-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold-400 font-display text-sm font-bold text-ink-950">
              K
            </span>
            <span className="font-display text-lg font-semibold tracking-tight text-white">KingdomFlow</span>
          </Link>
        </div>
        <div className="mb-4 px-3">
          <OrgSwitcher
            organizations={ctx.organizations}
            activeId={ctx.activeOrg.id}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-4">
          <SidebarNav items={items} />
        </div>
        <div className="border-t border-white/10 p-3">
          <div className="mb-2 flex items-center gap-2 px-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-royal-700 text-xs font-semibold text-white">
              {initials(ctx.user.fullName.split(" ")[0], ctx.user.fullName.split(" ")[1])}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">{ctx.user.fullName}</p>
              <p className="truncate text-[10px] text-ink-400">{ctx.user.email}</p>
            </div>
          </div>
          <form action={signOut}>
            <button className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-ink-300 hover:bg-white/5 hover:text-white">
              <LogOut className="h-3.5 w-3.5" aria-hidden /> Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 border-b border-ink-200 bg-white/90 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Link href="/dashboard" className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-ink-950 font-display text-xs font-bold text-gold-400">
                K
              </span>
              <span className="font-display text-base font-semibold">{ctx.activeOrg.name}</span>
            </Link>
            <form action={signOut}>
              <button className="text-xs font-semibold text-ink-500" aria-label="Sign out">
                Sign out
              </button>
            </form>
          </div>
          <div className="flex gap-1 overflow-x-auto px-3 pb-2">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-full border border-ink-200 px-3 py-1 text-xs font-medium text-ink-600"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>

        <footer className="no-print border-t border-ink-200 px-6 py-4 text-xs text-ink-400">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
            <span>© {new Date().getFullYear()} KingdomFlow · Members. Ministry. Growth.</span>
            <span className="capitalize">
              {ctx.role?.replace(/_/g, " ")} · {ctx.activeOrg.timezone}
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
