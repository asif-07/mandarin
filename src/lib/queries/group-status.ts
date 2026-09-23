import { daysFromToday, formatMoney } from "@/lib/format";
import { docCompleteness, groupCoverage, type DocStub } from "@/lib/queries/travel";

/** Shape every group card needs to decide what is outstanding. Pages select at least these columns. */
export type GroupStatusInput = {
  source: string;
  pack_path: string | null;
  entry_port: string | null;
  exit_port: string | null;
  visa_status: string;
  pax_expected?: number | null;
  travellers: { status: string; traveller_documents: DocStub[] }[];
  group_documents?: DocStub[] | null;
  invoices?: { id: string; invoice_number: string; total: number | string; currency: string; status: string }[] | null;
};

export type Balance = { received: number; balance: number };
export type Issue = { key: "docs" | "pack" | "travellers" | "ports" | "invoice" | "unpaid" | "draft" | "visa"; text: string; tone: "red" | "warning" | "neutral" };

/** Pax for a group: traveller records, or the partner's declared pax when we track no travellers. */
export function groupPax(g: Pick<GroupStatusInput, "source" | "pax_expected" | "travellers">): number {
  const active = g.travellers.filter((t) => t.status !== "cancelled").length;
  return g.source === "b2b" && g.pax_expected && active === 0 ? g.pax_expected : active;
}

/** Everything still to do for a group, in the order a coordinator would work it. */
export function groupIssues(g: GroupStatusInput, balances: Map<string, Balance>): Issue[] {
  const out: Issue[] = [];
  const active = g.travellers.filter((t) => t.status !== "cancelled");
  const cover = groupCoverage((g.group_documents ?? []).filter((d) => !d.deleted_at));
  if (g.source === "b2b") {
    if (!g.pack_path) out.push({ key: "pack", text: "Partner pack not uploaded", tone: "red" });
  } else if (active.length === 0) {
    out.push({ key: "travellers", text: "No travellers yet", tone: "warning" });
  } else {
    const missing = active.map((t) => docCompleteness(t.traveller_documents, cover)).filter((c) => !c.complete);
    if (missing.length) {
      const labels = [...new Set(missing.flatMap((c) => c.missingLabels))];
      out.push({ key: "docs", text: `${missing.length} of ${active.length} missing documents · ${labels.slice(0, 3).join(", ")}${labels.length > 3 ? "…" : ""}`, tone: "red" });
    }
  }
  if (!g.entry_port || !g.exit_port) out.push({ key: "ports", text: "Entry / exit port missing", tone: "warning" });
  const live = (g.invoices ?? []).filter((i) => i.status !== "cancelled");
  if (live.length === 0) out.push({ key: "invoice", text: "No invoice", tone: "warning" });
  else {
    const due = live.filter((i) => i.status === "issued" && (balances.get(i.id)?.balance ?? Number(i.total)) > 0);
    if (due.length) out.push({ key: "unpaid", text: `Invoice unpaid · ${due.map((i) => formatMoney(balances.get(i.id)?.balance ?? i.total, i.currency)).join(", ")} due`, tone: "warning" });
    if (live.some((i) => i.status === "draft")) out.push({ key: "draft", text: "Invoice still a draft", tone: "neutral" });
  }
  if (g.visa_status === "pending") out.push({ key: "visa", text: "Visa not applied", tone: "neutral" });
  else if (g.visa_status === "applied") out.push({ key: "visa", text: "Visa awaited", tone: "neutral" });
  return out;
}

export type Timing = { text: string; short: string; tone: "now" | "soon" | "later" | "past" };

/** Where a group is relative to today: travelling now, in N days, or returned. */
export function groupTiming(g: { travel_date: string; travel_end_date: string | null }): Timing {
  const start = daysFromToday(g.travel_date) ?? 0;
  const end = daysFromToday(g.travel_end_date ?? g.travel_date) ?? 0;
  if (end < 0) return { text: end === -1 ? "Returned yesterday" : `Returned ${-end} days ago`, short: "Returned", tone: "past" };
  if (start <= 0) return { text: end === 0 ? "Travelling now · returns today" : `Travelling now · ${end} day${end === 1 ? "" : "s"} left`, short: "Travelling now", tone: "now" };
  if (start === 1) return { text: "Travelling tomorrow", short: "Tomorrow", tone: "soon" };
  return { text: `Travelling in ${start} days`, short: `In ${start} days`, tone: start <= 7 ? "soon" : "later" };
}

/** Invoice state for a group in one word, with the number(s) behind it. */
export function groupInvoiceState(g: Pick<GroupStatusInput, "invoices">, balances: Map<string, Balance>): { label: string; tone: "success" | "warning" | "neutral" | "muted" } {
  const live = (g.invoices ?? []).filter((i) => i.status !== "cancelled");
  if (live.length === 0) return { label: "No invoice", tone: "warning" };
  const unpaid = live.filter((i) => i.status === "issued" && (balances.get(i.id)?.balance ?? Number(i.total)) > 0);
  if (unpaid.length) return { label: unpaid.some((i) => (balances.get(i.id)?.received ?? 0) > 0) ? "Partly paid" : "Unpaid", tone: "warning" };
  if (live.every((i) => i.status === "draft")) return { label: "Draft invoice", tone: "neutral" };
  return { label: "Paid", tone: "success" };
}
