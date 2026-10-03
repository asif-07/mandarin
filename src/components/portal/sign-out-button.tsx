"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SignOutButton({ url }: { url: string }) {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={async () => {
        await fetch(url, { method: "POST" }).catch(() => undefined);
        router.refresh();
      }}
    >
      <LogOut /> Sign out
    </Button>
  );
}
