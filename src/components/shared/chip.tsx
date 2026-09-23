import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ChipTone = "neutral" | "ink" | "red" | "success" | "warning" | "muted";

const TONES: Record<ChipTone, string> = {
  neutral: "bg-mr-surface text-mr-body",
  ink: "bg-mr-ink text-white",
  red: "bg-mr-red/10 text-mr-red",
  success: "bg-mr-success/10 text-mr-success",
  warning: "bg-mr-warning/10 text-mr-warning",
  muted: "bg-mr-surface text-mr-muted",
};

/** The one small status label used everywhere: same height, padding and tone colours. */
export function Chip({ tone = "neutral", icon, className, children, title }: { tone?: ChipTone; icon?: ReactNode; className?: string; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex h-6 max-w-full items-center gap-1 whitespace-nowrap rounded-md px-2 text-xs font-medium [&>svg]:size-3.5 [&>svg]:shrink-0", TONES[tone], className)}>
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}
