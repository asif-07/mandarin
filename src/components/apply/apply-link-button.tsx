"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Copies the public customer application link (share it with any individual traveller). */
export function ApplyLinkButton({ className, variant = "outline", size }: { className?: string; variant?: "outline" | "default" | "ghost"; size?: "sm" | "default" | "xs" }) {
  const url = typeof window !== "undefined" ? `${window.location.origin}/apply` : "/apply";
  return (
    <Button type="button" variant={variant} size={size} className={className} title={url} onClick={() => navigator.clipboard.writeText(url).then(() => toast.success("Customer application link copied: share it with any traveller")).catch(() => toast.error("Copy failed"))}>
      <Copy /> Copy customer link
    </Button>
  );
}
