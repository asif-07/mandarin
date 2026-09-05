import { cn } from "@/lib/utils";

type Tone = "neutral" | "ink" | "red" | "success" | "warning";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-mr-surface text-mr-body",
  ink: "bg-mr-ink text-white",
  red: "bg-mr-red/10 text-mr-red",
  success: "bg-mr-success/10 text-mr-success",
  warning: "bg-mr-warning/10 text-mr-warning",
};

export const INVOICE_TONES: Record<string, Tone> = {
  draft: "neutral",
  issued: "ink",
  paid: "success",
  cancelled: "red",
};

export const LEAD_TONES: Record<string, Tone> = {
  new: "ink",
  contacted: "neutral",
  quoted: "warning",
  negotiating: "warning",
  won: "success",
  lost: "red",
  on_hold: "neutral",
};

export const TRAVELLER_TONES: Record<string, Tone> = {
  documents_pending: "warning",
  documents_complete: "ink",
  visa_applied: "neutral",
  visa_approved: "success",
  travelled: "success",
  cancelled: "red",
};

export const DEAL_TONES: Record<string, Tone> = {
  draft: "neutral",
  active: "ink",
  completed: "success",
  cancelled: "red",
};

export const EXPENSE_TONES: Record<string, Tone> = {
  unpaid: "warning",
  paid: "success",
};

export function StatusPill({
  label,
  tone = "neutral",
  className,
}: {
  label: string;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center whitespace-nowrap rounded-md px-2 text-xs font-medium",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
