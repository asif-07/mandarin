import { cn } from "@/lib/utils";

/**
 * Page title row. On phones the actions drop below the title and stretch to
 * full width so primary buttons are easy to hit; on larger screens they sit
 * on the right.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4", className)}>
      <div className="min-w-0">
        <h1 className="text-xl leading-tight sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-mr-body">{description}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 [&>a]:flex-1 [&>button]:flex-1 sm:[&>a]:flex-none sm:[&>button]:flex-none">{actions}</div>
      )}
    </div>
  );
}
