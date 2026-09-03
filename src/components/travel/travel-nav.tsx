"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/travel", label: "By group", exact: true },
  { href: "/travel/travellers", label: "By traveller" },
  { href: "/travel/calendar", label: "Calendar" },
  { href: "/travel/groups", label: "Groups" },
];

export function TravelNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-6 -mx-4 overflow-x-auto border-b border-mr-line px-4 md:mx-0 md:px-0" aria-label="Travel views">
      <ul className="flex gap-1">
        {TABS.map((t) => {
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex h-10 items-center whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors",
                  active ? "border-mr-red text-mr-ink" : "border-transparent text-mr-body hover:text-mr-ink",
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
