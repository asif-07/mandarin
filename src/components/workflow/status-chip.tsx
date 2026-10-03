import { Chip } from "@/components/shared/chip";
import { workflowMeta } from "@/lib/constants";

/** One chip for a workflow status, worded for the side that is looking at it. */
export function WorkflowStatusChip({ status, variant = "company", className }: { status: string | null | undefined; variant?: "company" | "b2b" | "visa"; className?: string }) {
  const meta = workflowMeta(status);
  if (!meta) return <Chip tone="muted" className={className}>Manual · not in workflow</Chip>;
  const text = variant === "b2b" ? meta.b2b : variant === "visa" ? meta.visa : meta.label;
  const tone = meta.tone === "ink" ? "ink" : meta.tone === "success" ? "success" : meta.tone === "warning" ? "warning" : meta.tone === "red" ? "red" : "muted";
  return (
    <Chip tone={tone} className={className} title={meta.label}>
      {text}
    </Chip>
  );
}
