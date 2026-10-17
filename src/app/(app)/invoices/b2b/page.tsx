import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { StatCard, StatGrid } from "@/components/shared/stat-card";
import { Chip } from "@/components/shared/chip";
import { MarkPaidButton } from "@/components/invoices/mark-paid-button";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "B2B invoices" };
export const dynamic = "force-dynamic";

type Inv = { id: string; invoice_number: string; bill_to_name: string; issue_date: string; total: number; currency: string; status: string; group: { group_ref: string | null; partner_code: string | null; travel_date: string } | null; partner_code: string; received: number; balance: number };

const money = (m: Map<string, number>) => ([...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([c, v]) => formatMoney(v, c)).join(" · ") || "0");
const add = (m: Map<string, number>, c: string, v: number) => m.set(c, (m.get(c) ?? 0) + v);

/**
 * Every invoice that belongs to a B2B partner: through its travel group's
 * partner code, or because it is billed to the partner by name. Billed,
 * received and remaining per partner and overall, with the invoices listed
 * under each partner, unpaid first, with Mark as paid right there.
 */
export default async function B2bInvoicesPage({ searchParams }: { searchParams: Promise<{ partner?: string; show?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: partners }, { data: invoices, error }] = await Promise.all([
    supabase.from("b2b_partners").select("code, name").order("code"),
    supabase
      .from("invoices")
      .select("id, invoice_number, bill_to_name, issue_date, total, currency, status, group:travel_groups!invoices_travel_group_id_fkey(group_ref, partner_code, travel_date)")
      .in("status", ["issued", "paid"])
      .order("issue_date", { ascending: false })
      .limit(3000),
  ]);
  const byName = new Map((partners ?? []).filter((p) => p.name).map((p) => [p.name!.trim().toLowerCase(), p.code]));
  const byCode = new Map((partners ?? []).map((p) => [p.code, p.name ?? p.code]));
  const codes = new Set((partners ?? []).map((p) => p.code));
  const b2b = (invoices ?? [])
    .map((i) => {
      const fromGroup = i.group?.partner_code ?? null;
      const name = i.bill_to_name.trim().toLowerCase();
      const fromName = byName.get(name) ?? (codes.has(i.bill_to_name.trim().toUpperCase()) ? i.bill_to_name.trim().toUpperCase() : null);
      const partner_code = fromGroup ?? fromName;
      return partner_code ? { ...i, total: Number(i.total), partner_code } : null;
    })
    .filter((x): x is NonNullable<typeof x> & { partner_code: string } => !!x);

  const { data: pay } = b2b.length ? await supabase.rpc("invoice_payment_summary", { p_ids: b2b.map((i) => i.id) }) : { data: [] as { invoice_id: string; received: number; balance: number }[] };
  const payMap = new Map((pay ?? []).map((r) => [r.invoice_id, { received: Number(r.received), balance: Number(r.balance) }]));
  const rows: Inv[] = b2b.map((i) => {
    const p = payMap.get(i.id);
    const received = i.status === "paid" ? i.total : Math.min(i.total, p?.received ?? 0);
    return { ...i, received, balance: Math.max(0, i.total - received) };
  });

  const filtered = rows.filter((r) => (!sp.partner || r.partner_code === sp.partner) && (sp.show !== "unpaid" || r.balance > 0) && (sp.show !== "paid" || r.balance <= 0));
  const billed = new Map<string, number>();
  const received = new Map<string, number>();
  const outstanding = new Map<string, number>();
  filtered.forEach((r) => {
    add(billed, r.currency, r.total);
    add(received, r.currency, r.received);
    if (r.balance > 0) add(outstanding, r.currency, r.balance);
  });

  type PartnerTotals = { code: string; name: string; count: number; unpaid: number; billed: Map<string, number>; received: Map<string, number>; outstanding: Map<string, number>; invoices: Inv[] };
  const perPartner = new Map<string, PartnerTotals>();
  filtered.forEach((r) => {
    const t = perPartner.get(r.partner_code) ?? { code: r.partner_code, name: byCode.get(r.partner_code) ?? r.partner_code, count: 0, unpaid: 0, billed: new Map(), received: new Map(), outstanding: new Map(), invoices: [] as Inv[] };
    t.count += 1;
    if (r.balance > 0) t.unpaid += 1;
    add(t.billed, r.currency, r.total);
    add(t.received, r.currency, r.received);
    if (r.balance > 0) add(t.outstanding, r.currency, r.balance);
    t.invoices.push(r);
    perPartner.set(r.partner_code, t);
  });
  const partnersSorted = [...perPartner.values()].sort((a, b) => [...b.outstanding.values()].reduce((x, y) => x + y, 0) - [...a.outstanding.values()].reduce((x, y) => x + y, 0) || a.code.localeCompare(b.code));
  const q = (patch: Record<string, string | undefined>) => ({ pathname: "/invoices/b2b", query: Object.fromEntries(Object.entries({ partner: sp.partner, show: sp.show, ...patch }).filter(([, v]) => v)) });
  const unpaidCount = filtered.filter((r) => r.balance > 0).length;

  return (
    <>
      <PageHeader
        title="B2B invoices"
        description="Every invoice raised to a partner: through the group's partner code or billed to the partner by name. Billed, received and remaining per partner."
        actions={
          <>
            <Link href="/invoices" className={buttonVariants({ variant: "outline" })}>
              All invoices
            </Link>
            <Link href="/invoices/new" className={buttonVariants()}>
              <Plus /> New invoice
            </Link>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-1 text-xs">
        <Link href={q({ show: undefined })} className={`rounded-md px-2 py-1 ${!sp.show ? "bg-mr-ink text-white" : "bg-mr-surface text-mr-body hover:text-mr-ink"}`}>
          All
        </Link>
        <Link href={q({ show: "unpaid" })} className={`rounded-md px-2 py-1 ${sp.show === "unpaid" ? "bg-mr-ink text-white" : "bg-mr-surface text-mr-body hover:text-mr-ink"}`}>
          Remaining only
        </Link>
        <Link href={q({ show: "paid" })} className={`rounded-md px-2 py-1 ${sp.show === "paid" ? "bg-mr-ink text-white" : "bg-mr-surface text-mr-body hover:text-mr-ink"}`}>
          Fully paid
        </Link>
        <span className="mx-2 text-mr-muted">·</span>
        <Link href={q({ partner: undefined })} className={`rounded-md px-2 py-1 ${!sp.partner ? "bg-mr-ink text-white" : "bg-mr-surface text-mr-body hover:text-mr-ink"}`}>
          All partners
        </Link>
        {[...perPartner.keys(), ...(sp.partner && !perPartner.has(sp.partner) ? [sp.partner] : [])].sort().map((c) => (
          <Link key={c} href={q({ partner: c })} className={`rounded-md px-2 py-1 ${sp.partner === c ? "bg-mr-ink text-white" : "bg-mr-surface text-mr-body hover:text-mr-ink"}`}>
            {c}
          </Link>
        ))}
      </div>

      {error ? (
        <p className="text-sm text-mr-red">Could not load invoices: {error.message}</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Building2} title={rows.length === 0 ? "No partner invoices yet. An invoice counts as B2B when its group has a partner code or it is billed to a partner's name." : "No partner invoices match these filters."} />
      ) : (
        <>
          <StatGrid cols={4} className="mb-6">
            <StatCard label="B2B invoices" value={filtered.length} hint={`${unpaidCount} with a balance · ${perPartner.size} partner${perPartner.size === 1 ? "" : "s"}`} tone="ink" />
            <StatCard label="Total billed" value={money(billed)} hint="issued and paid" tone="neutral" />
            <StatCard label="B2B paid" value={money(received)} hint="receipts recorded or marked paid" tone={received.size ? "success" : "neutral"} />
            <StatCard label="Remaining" value={money(outstanding)} hint="still due from partners" tone={outstanding.size ? "red" : "success"} href={sp.show === "unpaid" ? undefined : "/invoices/b2b?show=unpaid"} />
          </StatGrid>

          <div className="mb-6 overflow-x-auto rounded-lg border border-mr-line bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-mr-surface text-left">
                  {["Partner", "Invoices", "Billed", "Paid", "Remaining"].map((h) => (
                    <th key={h} className={`micro-label h-10 whitespace-nowrap px-3 ${h === "Partner" ? "" : "text-right"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-mr-line">
                {partnersSorted.map((p) => (
                  <tr key={p.code}>
                    <td className="px-3 py-2">
                      <Link href={q({ partner: p.code })} className="font-medium text-mr-ink hover:underline">
                        {p.code}
                      </Link>
                      {p.name !== p.code && <span className="ml-2 text-xs text-mr-muted">{p.name}</span>}
                    </td>
                    <td className="tnum px-3 py-2 text-right">
                      {p.count}
                      {p.unpaid ? <span className="ml-1 text-xs text-mr-warning">({p.unpaid} due)</span> : null}
                    </td>
                    <td className="tnum px-3 py-2 text-right">{money(p.billed)}</td>
                    <td className="tnum px-3 py-2 text-right text-mr-success">{money(p.received)}</td>
                    <td className={`tnum px-3 py-2 text-right font-semibold ${p.outstanding.size ? "text-mr-red" : "text-mr-muted"}`}>{p.outstanding.size ? money(p.outstanding) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-6">
            {partnersSorted.map((p) => (
              <section key={p.code}>
                <h2 className="mb-2 flex flex-wrap items-baseline gap-3 border-b border-mr-line pb-1">
                  <span className="font-heading text-lg font-semibold">
                    {p.code}
                    {p.name !== p.code ? <span className="font-sans text-sm font-normal text-mr-body"> · {p.name}</span> : null}
                  </span>
                  <span className="text-sm text-mr-muted">
                    billed {money(p.billed)} · paid {money(p.received)} · remaining <span className={p.outstanding.size ? "font-semibold text-mr-red" : ""}>{p.outstanding.size ? money(p.outstanding) : "0"}</span>
                  </span>
                </h2>
                <ul className="divide-y divide-mr-line rounded-lg border border-mr-line bg-white">
                  {[...p.invoices]
                    .sort((a, b) => (a.balance > 0 ? 0 : 1) - (b.balance > 0 ? 0 : 1) || b.issue_date.localeCompare(a.issue_date))
                    .map((i) => (
                      <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                        <Link href={`/invoices/${i.id}`} className="font-mono text-xs font-medium text-mr-ink hover:underline">
                          {i.invoice_number}
                        </Link>
                        <span className="tnum text-xs text-mr-muted">{formatDate(i.issue_date)}</span>
                        <span className="min-w-0 flex-1 truncate text-sm text-mr-body">
                          {i.bill_to_name}
                          {i.group?.group_ref ? <span className="ml-2 font-mono text-[11px] text-mr-muted">{i.group.group_ref}</span> : null}
                        </span>
                        <span className="tnum text-sm">{formatMoney(i.total, i.currency)}</span>
                        <span className="tnum text-xs text-mr-success">paid {formatMoney(i.received, i.currency)}</span>
                        {i.balance > 0 ? (
                          <>
                            <Chip tone={i.received > 0 ? "warning" : "red"}>{formatMoney(i.balance, i.currency)} due</Chip>
                            {i.status === "issued" && <MarkPaidButton invoiceId={i.id} invoiceNumber={i.invoice_number} balance={i.balance} currency={i.currency} />}
                          </>
                        ) : (
                          <Chip tone="success">Paid</Chip>
                        )}
                      </li>
                    ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}
