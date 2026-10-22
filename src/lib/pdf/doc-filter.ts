import { DOC_TYPES } from "@/lib/constants";

/**
 * "par,passport" -> ["par", "passport"]; unknown names are dropped; null when
 * nothing (valid) was asked for, which means "every document" to the builders.
 */
export function parseDocTypes(raw: string | null | undefined): string[] | null {
  if (!raw) return null;
  const known = new Set<string>(DOC_TYPES.map((d) => d.value));
  const list = [...new Set(raw.split(",").map((s) => s.trim()).filter((s) => known.has(s)))];
  return list.length ? list : null;
}
