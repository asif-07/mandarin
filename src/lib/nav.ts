import { NAV_ITEMS } from "@/lib/constants";

export type NavChild = { href: string; label: string; exact?: boolean };
export type NavItem = (typeof NAV_ITEMS)[number] & { children?: readonly NavChild[] };

function matches(href: string, pathname: string, exact?: boolean): boolean {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Which top-level section a path belongs to, and which sub-tab inside it.
 * Children win over section prefixes (so /travel/b2b is "B2B partners", not
 * "Travel"); the longest matching href wins when several match.
 */
export function resolveNav(pathname: string): { item: NavItem | null; child: NavChild | null } {
  let best: { item: NavItem; child: NavChild | null; len: number } | null = null;
  for (const raw of NAV_ITEMS) {
    const item = raw as NavItem;
    for (const c of item.children ?? []) {
      if (matches(c.href, pathname, c.exact) && (!best || c.href.length > best.len)) best = { item, child: c, len: c.href.length };
    }
  }
  if (best) return { item: best.item, child: best.child };
  for (const raw of NAV_ITEMS) {
    const item = raw as NavItem;
    if (item.href === "/" ? pathname === "/" : matches(item.href, pathname)) {
      if (!best || item.href.length > best.len) best = { item, child: null, len: item.href.length };
    }
  }
  return best ? { item: best.item, child: null } : { item: null, child: null };
}
