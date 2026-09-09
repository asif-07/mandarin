import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, parse, startOfMonth, startOfWeek } from "date-fns";
import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Travel calendar" };

export default async function TravelCalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams;
  const today = todayISO();
  const monthStr = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : today.slice(0, 7);
  const monthStart = startOfMonth(parse(`${monthStr}-01`, "yyyy-MM-dd", new Date()));
  const monthEnd = endOfMonth(monthStart);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const from = format(gridStart, "yyyy-MM-dd");
  const to = format(gridEnd, "yyyy-MM-dd");

  const supabase = await createClient();
  const [{ data: travellers }, { data: groups }] = await Promise.all([
    supabase.from("travellers").select("travel_start_date").gte("travel_start_date", from).lte("travel_start_date", to).neq("status", "cancelled"),
    supabase.from("travel_groups").select("travel_date, group_code, source, partner_code, pax_expected").gte("travel_date", from).lte("travel_date", to).order("group_code"),
  ]);

  const travellerCount = new Map<string, number>();
  (travellers ?? []).forEach((t) => travellerCount.set(t.travel_start_date, (travellerCount.get(t.travel_start_date) ?? 0) + 1));
  const groupsByDay = new Map<string, { group_code: string; source: string; partner_code: string | null; pax_expected: number | null }[]>();
  (groups ?? []).forEach((g) => groupsByDay.set(g.travel_date, [...(groupsByDay.get(g.travel_date) ?? []), g]));

  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const prevMonth = format(addMonths(monthStart, -1), "yyyy-MM");
  const nextMonth = format(addMonths(monthStart, 1), "yyyy-MM");

  return (
    <>
      <PageHeader
        title="Travel calendar"
        description="Travellers departing and groups starting per day. Dark chips are B2B partner groups."
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/travel/calendar?month=${prevMonth}`} className={buttonVariants({ variant: "outline", size: "icon" })} aria-label="Previous month">
              <ChevronLeft />
            </Link>
            <span className="min-w-[140px] text-center text-sm font-medium">{format(monthStart, "MMMM yyyy")}</span>
            <Link href={`/travel/calendar?month=${nextMonth}`} className={buttonVariants({ variant: "outline", size: "icon" })} aria-label="Next month">
              <ChevronRight />
            </Link>
          </div>
        }
      />
      <div className="overflow-x-auto">
        <div className="min-w-[640px] overflow-hidden rounded-lg border border-mr-line">
          <div className="grid grid-cols-7 border-b border-mr-line bg-mr-surface">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="micro-label px-2 py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const iso = format(day, "yyyy-MM-dd");
              const inMonth = day >= monthStart && day <= monthEnd;
              const tc = travellerCount.get(iso) ?? 0;
              const dayGroups = groupsByDay.get(iso) ?? [];
              const gc = dayGroups.length;
              const isToday = iso === today;
              return (
                <Link
                  key={iso}
                  href={`/travel?date=${iso}`}
                  className={cn(
                    "flex min-h-[84px] flex-col border-b border-r border-mr-line p-2 text-sm transition-colors hover:bg-mr-surface",
                    !inMonth && "bg-mr-surface/40 text-mr-muted",
                  )}
                >
                  <span className={cn("tnum mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs", isToday && "bg-mr-red font-semibold text-white")}>
                    {format(day, "d")}
                  </span>
                  {tc > 0 && (
                    <span className="tnum text-xs font-medium text-mr-ink">
                      {tc} traveller{tc === 1 ? "" : "s"}
                    </span>
                  )}
                  {gc > 0 && (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {dayGroups.slice(0, 4).map((g) => (
                        <span
                          key={g.group_code}
                          className={cn("rounded px-1 py-0.5 text-[10px] font-medium leading-none", g.source === "b2b" ? "bg-mr-ink text-white" : "bg-mr-surface text-mr-body")}
                          title={g.source === "b2b" ? `${g.group_code} · B2B ${g.partner_code} · ${g.pax_expected ?? 0} pax` : g.group_code}
                        >
                          {g.group_code}
                          {g.source === "b2b" ? ` ${g.partner_code}` : ""}
                        </span>
                      ))}
                      {gc > 4 && <span className="text-[10px] text-mr-muted">+{gc - 4}</span>}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
