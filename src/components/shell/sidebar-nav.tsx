"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, LayoutDashboard, Plane, Settings, Users, Wallet, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";

const ICONS: Record<(typeof NAV_ITEMS)[number]["icon"], LucideIcon> = {
  LayoutDashboard,
  FileText,
  Users,
  Plane,
  Wallet,
  Settings,
};

export function SidebarNav({ onNavigate, admin = false }: { onNavigate?: () => void; admin?: boolean }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => admin || !item.adminOnly);

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mr-ink",
              active
                ? "bg-mr-surface text-mr-red"
                : "text-mr-body hover:bg-mr-surface hover:text-mr-ink",
            )}
          >
            <Icon className="size-4" strokeWidth={active ? 2.25 : 2} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
