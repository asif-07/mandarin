import Link from "next/link";
import { Bell } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { NotificationRow } from "@/lib/workflow/data";
import { cn } from "@/lib/utils";

/** Notifications for one audience, unread ones highlighted; each links to its group where a link builder is given. */
export function NotificationsList({ items, hrefFor, emptyText = "No notifications yet." }: { items: NotificationRow[]; hrefFor?: (n: NotificationRow) => string | null; emptyText?: string }) {
  if (items.length === 0) return <p className="text-sm text-mr-muted">{emptyText}</p>;
  return (
    <ul className="divide-y divide-mr-line rounded-lg border border-mr-line bg-white">
      {items.map((n) => {
        const href = hrefFor?.(n) ?? null;
        const inner = (
          <>
            <div className="flex items-start gap-2">
              <Bell className={cn("mt-0.5 size-3.5 shrink-0", n.read_at ? "text-mr-muted" : "text-mr-red")} />
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm", n.read_at ? "text-mr-body" : "font-medium text-mr-ink")}>{n.title}</p>
                {n.body && <p className="text-xs text-mr-muted">{n.body}</p>}
                <p className="mt-0.5 text-[11px] text-mr-muted">
                  {formatDateTime(n.created_at)}
                  {n.email_status ? ` · email ${n.email_status}${n.email_to ? ` to ${n.email_to}` : ""}${n.email_error && n.email_status !== "sent" ? ` (${n.email_error})` : ""}` : ""}
                </p>
              </div>
            </div>
          </>
        );
        return (
          <li key={n.id} className="px-4 py-2.5">
            {href ? (
              <Link href={href} className="block hover:underline">
                {inner}
              </Link>
            ) : (
              inner
            )}
          </li>
        );
      })}
    </ul>
  );
}
