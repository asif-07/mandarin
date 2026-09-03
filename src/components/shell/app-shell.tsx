"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { UserMenu } from "@/components/shell/user-menu";
import type { Profile } from "@/lib/auth";

export function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-white">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[240px] flex-col border-r border-mr-line bg-white md:flex">
        <div className="flex h-16 items-center px-6">
          <Link href="/" aria-label="Dashboard">
            <Image src="/logo.png" alt="Mandarin Roots" width={174} height={32} priority className="h-8 w-auto" />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <SidebarNav />
        </div>
        <div className="border-t border-mr-line p-3">
          <UserMenu profile={profile} variant="sidebar" />
        </div>
      </aside>

      {/* Mobile sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[280px] p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-16 items-center border-b border-mr-line px-6">
            <Image src="/logo.png" alt="Mandarin Roots" width={174} height={32} className="h-8 w-auto" />
          </div>
          <div className="px-3 py-2">
            <SidebarNav onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col md:pl-[240px]">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-mr-line bg-white/95 px-4 backdrop-blur md:h-12 md:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </Button>
          <Link href="/" className="md:hidden">
            <Image src="/logo.png" alt="Mandarin Roots" width={130} height={24} className="h-6 w-auto" />
          </Link>
          <div className="ml-auto">
            <UserMenu profile={profile} variant="topbar" />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
