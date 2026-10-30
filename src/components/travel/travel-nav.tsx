"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { resolveNav } from "@/lib/nav";

/** Sub-tabs of the current section only (Travel, B2B partners or Operations), so each page shows one thing. */
export function TravelNav() {
  const pathname = usePathname();
  const { item, child } = resolveNav(pathname);
  const tabs = item?.children ?? [];
  if (tabs.length === 0) return null;
  return (
    <nav className="mb-6 -mx-4 overflow-x-auto border-b border-mr-line px-4 md:mx-0 md:px-0" aria-label={`${item?.label} views`}>
      <ul className="flex gap-1">
        {tabs.map((t) => {
          const active = child?.href === t.href;
          return (
            <li key={t.href}>
              <Link href={t.href} aria-current={active ? "page" : undefined} className={cn("-mb-px inline-flex h-10 items-center whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors", active ? "border-mr-red text-mr-ink" : "border-transparent text-mr-body hover:text-mr-ink")}>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
