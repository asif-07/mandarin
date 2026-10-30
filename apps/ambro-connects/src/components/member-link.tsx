"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemberSession } from "./member-session";

export function MemberLink({
  href,
  memberHref = "/account?tab=membership",
  memberLabel = "My membership",
  className,
  children,
  icon,
  ariaLabel,
  iconOnly = false,
}: {
  href: string;
  memberHref?: string;
  memberLabel?: string;
  className?: string;
  children: ReactNode;
  icon?: ReactNode;
  ariaLabel?: string;
  iconOnly?: boolean;
}) {
  const { status } = useMemberSession();
  const member = status === "authenticated";
  const checking = status === "loading" || status === "error";
  return (
    <Link
      href={member || checking ? memberHref : href}
      className={className}
      aria-label={member || checking ? memberLabel : ariaLabel}
    >
      {iconOnly ? null : member || checking ? memberLabel : children}
      {icon}
    </Link>
  );
}
