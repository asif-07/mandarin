"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PAGE_SIZE } from "@/lib/constants";

export function Pagination({ page, total, pageSize = PAGE_SIZE }: { page: number; total: number; pageSize?: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;

  const href = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    return `${pathname}?${params.toString()}`;
  };
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between py-4 text-sm text-mr-body">
      <span className="tnum">
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-2">
        <Link
          href={href(page - 1)}
          aria-disabled={page <= 1}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), page <= 1 && "pointer-events-none opacity-50")}
        >
          <ChevronLeft /> Previous
        </Link>
        <span className="tnum px-2">
          {page} / {pages}
        </span>
        <Link
          href={href(page + 1)}
          aria-disabled={page >= pages}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), page >= pages && "pointer-events-none opacity-50")}
        >
          Next <ChevronRight />
        </Link>
      </div>
    </div>
  );
}

