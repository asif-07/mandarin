"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, FileCheck2, FileText, LayoutDashboard, Plane, Route, Settings, Users, Wallet, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";
import { resolveNav, type NavItem } from "@/lib/nav";

const ICONS: Record<(typeof NAV_ITEMS)[number]["icon"], LucideIcon> = {
  LayoutDashboard,
  FileText,
  Users,
  Plane,
  Building2,
  Route,
  FileCheck2,
  Wallet,
  Settings,
};

/** Sidebar: one entry per section; the open section lists its sub-pages underneath. */
export function SidebarNav({ onNavigate, admin = false }: { onNavigate?: () => void; admin?: boolean }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => admin || !item.adminOnly) as NavItem[];
  const current = resolveNav(pathname);

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = current.item?.href === item.href && current.item?.label === item.label;
        const children = item.children ?? [];
        return (
          <div key={item.href + item.label}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active && !children.length ? "page" : undefined}
              className={cn(
                "flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mr-ink",
                active ? "bg-mr-surface text-mr-red" : "text-mr-body hover:bg-mr-surface hover:text-mr-ink",
              )}
            >
              <Icon className="size-4" strokeWidth={active ? 2.25 : 2} />
              {item.label}
            </Link>
            {active && children.length > 0 && (
              <ul className="my-1 ml-5 border-l border-mr-line pl-2">
                {children.map((c) => {
                  const on = current.child?.href === c.href;
                  return (
                    <li key={c.href}>
                      <Link href={c.href} onClick={onNavigate} aria-current={on ? "page" : undefined} className={cn("flex h-8 items-center rounded-md px-2.5 text-[13px] transition-colors", on ? "bg-mr-surface font-medium text-mr-ink" : "text-mr-body hover:text-mr-ink")}>
                        {c.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}
