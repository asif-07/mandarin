"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/accounts", label: "Overview", exact: true },
  { href: "/accounts/receivables", label: "Receivables" },
  { href: "/accounts/deals", label: "B2B deals" },
  { href: "/accounts/receipts", label: "Money in" },
  { href: "/accounts/expenses", label: "Money out" },
  { href: "/accounts/ledgers", label: "Cash & bank" },
  { href: "/accounts/parties", label: "Partners & suppliers" },
  { href: "/accounts/reports", label: "Reports" },
];

export function AccountsNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-6 -mx-4 overflow-x-auto border-b border-mr-line px-4 md:mx-0 md:px-0" aria-label="Accounts views">
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
