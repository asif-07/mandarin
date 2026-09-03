import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  action,
}: {
  icon: LucideIcon;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-mr-line px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-mr-surface">
        <Icon className="size-5 text-mr-muted" />
      </div>
      <p className="mt-4 text-sm text-mr-body">{title}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
