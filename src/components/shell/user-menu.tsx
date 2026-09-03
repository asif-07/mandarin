"use client";

import { useTransition } from "react";
import Link from "next/link";
import { ChevronsUpDown, LogOut, Settings } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/actions/auth";
import type { Profile } from "@/lib/auth";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function UserMenu({ profile, variant }: { profile: Profile; variant: "sidebar" | "topbar" }) {
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-3 rounded-md text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mr-ink",
          variant === "sidebar" && "w-full px-2 py-1.5 hover:bg-mr-surface",
          variant === "topbar" && "md:hidden",
        )}
        aria-label="Account menu"
      >
        <Avatar className="size-8">
          <AvatarFallback className="bg-mr-ink text-xs font-semibold text-white">
            {initials(profile.display_name)}
          </AvatarFallback>
        </Avatar>
        {variant === "sidebar" && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-mr-ink">{profile.display_name}</span>
              <span className="block truncate text-xs capitalize text-mr-muted">{profile.role}</span>
            </span>
            <ChevronsUpDown className="size-4 text-mr-muted" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <span className="block text-sm font-medium">{profile.display_name}</span>
          <span className="block text-xs font-normal text-mr-muted">@{profile.username}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={pending}
          onSelect={(e) => {
            e.preventDefault();
            startTransition(() => signOut());
          }}
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
