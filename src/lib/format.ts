import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { differenceInCalendarDays, parseISO, isValid } from "date-fns";
import { TIMEZONE } from "@/lib/constants";

type DateInput = string | Date | null | undefined;

function toDate(input: DateInput): Date | null {
  if (!input) return null;
  const d = typeof input === "string" ? parseISO(input) : input;
  return isValid(d) ? d : null;
}

/** "22 Aug 2026" in Asia/Dubai. Date-only strings (yyyy-MM-dd) are treated as plain dates. */
export function formatDate(input: DateInput): string {
  if (!input) return "";
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split("-").map(Number);
    return formatInTimeZone(new Date(Date.UTC(y, m - 1, d, 12)), "UTC", "d MMM yyyy");
  }
  const d = toDate(input);
  return d ? formatInTimeZone(d, TIMEZONE, "d MMM yyyy") : "";
}

/** "22 Aug 2026, 14:05" in Asia/Dubai. */
export function formatDateTime(input: DateInput): string {
  const d = toDate(input);
  return d ? formatInTimeZone(d, TIMEZONE, "d MMM yyyy, HH:mm") : "";
}

/** Today's date in Asia/Dubai as yyyy-MM-dd. */
export function todayISO(): string {
  return formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");
}

export function toISODate(d: Date): string {
  return formatInTimeZone(d, TIMEZONE, "yyyy-MM-dd");
}

/** Calendar days from today (Asia/Dubai) to the given date. Negative = past. */
export function daysFromToday(input: DateInput): number | null {
  if (!input) return null;
  const target = typeof input === "string" ? parseISO(input) : input;
  if (!isValid(target)) return null;
  const now = toZonedTime(new Date(), TIMEZONE);
  return differenceInCalendarDays(target, now);
}

export function formatMoney(amount: number | string | null | undefined, currency = "USD"): string {
  const n = typeof amount === "string" ? Number(amount) : (amount ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(Number.isFinite(n) ? n : 0)
    .replace(/ /g, " ");
}

/** "1,234.50" without a currency code. */
export function formatNumber(amount: number | string | null | undefined, digits = 2): string {
  const n = typeof amount === "string" ? Number(amount) : (amount ?? 0);
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(n) ? n : 0);
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function padIndex(n: number): string {
  return String(n).padStart(2, "0");
}
