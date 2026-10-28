"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote, CalendarDays, ClipboardCheck, Church, FileBarChart, FolderTree, LayoutDashboard,
  Settings, ShieldCheck, UserRound, UserRoundCheck, Users, UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

const ICONS = {
  dashboard: LayoutDashboard,
  members: Users,
  branches: Church,
  departments: FolderTree,
  attendance: ClipboardCheck,
  events: CalendarDays,
  giving: Banknote,
  visitors: UserRoundCheck,
  followups: UserRound,
  reports: FileBarChart,
  team: UsersRound,
  audit: ShieldCheck,
  settings: Settings,
} as const;

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 px-3" aria-label="Main navigation">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-white/10 text-white" : "text-ink-300 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
