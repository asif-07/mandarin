import { formatDate } from "@/lib/format";

/** "Added by Sales, 22 Aug 2026" */
export function Attribution({
  name,
  date,
  verb = "Added",
  className,
}: {
  name?: string | null;
  date?: string | null;
  verb?: string;
  className?: string;
}) {
  if (!name && !date) return null;
  return (
    <span className={className ?? "text-xs text-mr-muted"}>
      {verb}
      {name ? ` by ${name}` : ""}
      {date ? `, ${formatDate(date)}` : ""}
    </span>
  );
}
