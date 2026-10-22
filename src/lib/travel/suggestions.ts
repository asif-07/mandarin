import { differenceInCalendarDays, parseISO } from "date-fns";
import { formatDateRange } from "@/lib/format";

/**
 * Group suggestions for travellers who are not in a group yet. The China
 * group visa needs at least two travellers, so a customer travelling alone
 * on Nov 2–7 is better off joining a group that leaves Nov 1–6 than waiting.
 * Two kinds of suggestion: merge into an existing group whose dates are
 * within `tolerance` days on both ends (the traveller takes the group's
 * dates), or pair up with another ungrouped traveller on similar dates.
 */
export const SUGGESTION_TOLERANCE_DAYS = 3;
export const MIN_GROUP_PAX = 2;

export type SuggestGroup = { id: string; group_ref: string | null; travel_date: string; travel_end_date: string; pax: number; label?: string | null; visa_status?: string | null };
export type SuggestTraveller = { id: string; full_name: string; traveller_ref: string; travel_start_date: string; travel_end_date: string; source?: string | null };

export type Suggestion =
  | { kind: "group"; group: SuggestGroup; shiftStart: number; shiftEnd: number; score: number; reason: string }
  | { kind: "pair"; travellers: SuggestTraveller[]; travel_date: string; travel_end_date: string; score: number; reason: string };

function days(a: string, b: string): number {
  return differenceInCalendarDays(parseISO(b), parseISO(a));
}

function shiftText(n: number, what: string): string {
  if (n === 0) return `same ${what}`;
  const abs = Math.abs(n);
  return `${what} ${abs} day${abs === 1 ? "" : "s"} ${n < 0 ? "earlier" : "later"}`;
}

/** Suggestions for one ungrouped traveller, best first. */
export function suggestForTraveller(t: SuggestTraveller, groups: SuggestGroup[], others: SuggestTraveller[], tolerance = SUGGESTION_TOLERANCE_DAYS): Suggestion[] {
  const out: Suggestion[] = [];
  for (const g of groups) {
    if (g.visa_status === "approved") continue; // the visa is already issued for that group's names
    const shiftStart = days(t.travel_start_date, g.travel_date);
    const shiftEnd = days(t.travel_end_date, g.travel_end_date);
    if (Math.abs(shiftStart) > tolerance || Math.abs(shiftEnd) > tolerance) continue;
    const score = Math.abs(shiftStart) + Math.abs(shiftEnd) - Math.min(g.pax, 5) * 0.1;
    out.push({ kind: "group", group: g, shiftStart, shiftEnd, score, reason: `${g.group_ref ?? g.label ?? "Group"} · ${formatDateRange(g.travel_date, g.travel_end_date)} · ${g.pax} pax · ${shiftText(shiftStart, "entry")}, ${shiftText(shiftEnd, "exit")}` });
  }
  const mates = others.filter((o) => o.id !== t.id && Math.abs(days(t.travel_start_date, o.travel_start_date)) <= tolerance && Math.abs(days(t.travel_end_date, o.travel_end_date)) <= tolerance);
  if (mates.length) {
    const all = [t, ...mates];
    // A shared window: the latest entry and the earliest exit keeps everyone inside their own dates.
    const travel_date = all.map((x) => x.travel_start_date).sort().at(-1)!;
    const travel_end_date = all.map((x) => x.travel_end_date).sort()[0]!;
    const ok = travel_end_date >= travel_date;
    const score = 0.5 + mates.reduce((n, o) => n + Math.abs(days(t.travel_start_date, o.travel_start_date)) + Math.abs(days(t.travel_end_date, o.travel_end_date)), 0) / mates.length;
    out.push({
      kind: "pair",
      travellers: all,
      travel_date: ok ? travel_date : t.travel_start_date,
      travel_end_date: ok ? travel_end_date : t.travel_end_date,
      score,
      reason: `${mates.length === 1 ? `${mates[0]!.full_name} travels` : `${mates.length} other travellers travel`} on similar dates: make a group of ${all.length}${ok ? ` for ${formatDateRange(travel_date, travel_end_date)}` : ""}`,
    });
  }
  return out.sort((a, b) => a.score - b.score).slice(0, 3);
}
