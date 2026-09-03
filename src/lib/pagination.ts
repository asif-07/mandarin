import { PAGE_SIZE } from "@/lib/constants";

/** Parse a ?page= value; anything invalid becomes page 1. */
export function parsePage(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

/** Inclusive [from, to] row range for Supabase `.range()`. */
export function pageRange(page: number, pageSize = PAGE_SIZE): [number, number] {
  const from = (page - 1) * pageSize;
  return [from, from + pageSize - 1];
}
