import type { Metadata } from "next";
import { Suspense } from "react";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { B2bUploadButton, ReplaceB2bPackButton } from "@/components/travel/b2b-upload";
import { PartnersButton } from "@/components/travel/partner-logos";
import { GroupCard } from "@/components/travel/group-card";
import { StatCard, StatGrid } from "@/components/shared/stat-card";
import { groupIssues, groupPax } from "@/lib/queries/group-status";
import { BUCKETS } from "@/lib/constants";
import { SearchParamInput } from "@/components/shared/url-filters";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, todayISO } from "@/lib/format";

export const metadata: Metadata = { title: "B2B groups" };

export default async function B2bGroupsPage({ searchParams }: { searchParams: Promise<{ q?: string; all?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("travel_groups")
    .select(
      "id, travel_date, travel_end_date, group_code, label, guide_name, notes, reference_prefix, entry_port, exit_port, source, partner_code, partner_reference, pax_expected, pack_path, pack_file_name, pack_uploaded_at, package_tier, hotel_name, hotel_stars, transit_location, visa_status, visa_applied_at, visa_uploaded_at, visa_path, group_ref, uploader:profiles!travel_groups_pack_uploaded_by_fkey(display_name), travellers(id, full_name, status, package_tier, passport_number, visa_reference, traveller_documents(doc_type, deleted_at)), invoices:invoices!invoices_travel_group_id_fkey(id, invoice_number, total, currency, status), group_documents(id, doc_type, file_name, file_size, uploaded_at, deleted_at)",
    )
    .or("source.eq.b2b,partner_code.not.is.null")
    .order("travel_date", { ascending: false })
    .order("group_code")
    .limit(200);
  if (sp.q) {
    const like = `%${sp.q.trim().replace(/[%,]/g, "")}%`;
    query = query.or(`partner_code.ilike.${like},partner_reference.ilike.${like},group_code.ilike.${like},label.ilike.${like}`);
  }
  const [{ data, error }, { data: partnerRows }] = await Promise.all([query, supabase.from("b2b_partners").select("id, code, name, phone, email, address, logo_path, logo_file_name").order("code")]);
  // Next departure first: groups still to travel (or travelling) in date order, then finished ones most recent first.
  const today = todayISO();
  const groups = [...(data ?? [])].sort((a, b) => {
    const aOpen = a.travel_end_date >= today;
    const bOpen = b.travel_end_date >= today;
    if (aOpen !== bOpen) return aOpen ? -1 : 1;
    const cmp = aOpen ? a.travel_date.localeCompare(b.travel_date) : b.travel_date.localeCompare(a.travel_date);
    return cmp || a.group_code.localeCompare(b.group_code);
  });
  const logoPaths = (partnerRows ?? []).map((p) => p.logo_path).filter((p): p is string => !!p);
  const { data: signedLogos } = logoPaths.length ? await supabase.storage.from(BUCKETS.partnerLogos).createSignedUrls(logoPaths, 3600) : { data: [] as { path: string | null; signedUrl: string }[] };
  const logoUrl = new Map((signedLogos ?? []).map((s) => [s.path, s.signedUrl]));
  const partners = (partnerRows ?? []).map((p) => ({ ...p, logo_url: p.logo_path ? (logoUrl.get(p.logo_path) ?? null) : null }));
  const partnerHasLogo = new Map(partners.map((p) => [p.code, !!p.logo_path]));

  const invoiceIds = groups.flatMap((g) => g.invoices.filter((i) => i.status !== "cancelled").map((i) => i.id));
  const { data: paymentRows } = invoiceIds.length ? await supabase.rpc("invoice_payment_summary", { p_ids: invoiceIds }) : { data: [] as { invoice_id: string; received: number; balance: number; receipt_count: number }[] };
  const balances = new Map((paymentRows ?? []).map((r) => [r.invoice_id, { received: Number(r.received), balance: Number(r.balance) }]));
  const issueList = groups.map((g) => ({ g, issues: groupIssues(g, balances) }));
  const stats = {
    groups: groups.length,
    pax: groups.reduce((n, g) => n + groupPax(g), 0),
    upcoming: groups.filter((g) => g.travel_end_date >= today).length,
    noPack: groups.filter((g) => g.source === "b2b" && !g.pack_path).length,
    unbilled: issueList.filter((x) => x.issues.some((i) => i.key === "invoice")).length,
    unpaid: issueList.filter((x) => x.issues.some((i) => i.key === "unpaid")).length,
  };

  const byPartner = new Map<string, number>();
  groups.forEach((g) => byPartner.set(g.partner_code ?? "?", (byPartner.get(g.partner_code ?? "?") ?? 0) + 1));

  return (
    <>
      <PageHeader
        title="B2B partner groups"
        description="Packs compiled by partner agencies, plus our own groups that belong to a partner. Upload a partner's PDF with their code and it is filed under the next free group number for that date."
        actions={
          <>
            <PartnersButton partners={partners} />
            <B2bUploadButton />
          </>
        }
      />
      <Suspense>
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <SearchParamInput placeholder="Search partner, code or label" className="md:w-80" />
          {byPartner.size > 0 && <span className="text-xs text-mr-muted">{[...byPartner.entries()].map(([p, n]) => `${p} ${n}`).join(" · ")}</span>}
        </div>
      </Suspense>

      {!error && groups.length > 0 && (
        <StatGrid cols={6} className="mb-6">
          <StatCard label="Partner groups" value={stats.groups} hint={`${stats.pax} pax`} tone="ink" />
          <StatCard label="Upcoming" value={stats.upcoming} hint="still to travel" tone="neutral" />
          <StatCard label="Pack missing" value={stats.noPack} hint="no partner PDF yet" tone={stats.noPack ? "red" : "success"} />
          <StatCard label="Unbilled" value={stats.unbilled} hint="no invoice yet" tone={stats.unbilled ? "warning" : "success"} />
          <StatCard label="Unpaid" value={stats.unpaid} hint="invoice balance due" tone={stats.unpaid ? "warning" : "success"} />
          <StatCard label="Partners" value={partners.length} hint={`${partners.filter((p) => p.logo_path).length} with a logo`} tone="neutral" />
        </StatGrid>
      )}

      {error ? (
        <p className="text-sm text-mr-red">Could not load groups: {error.message}</p>
      ) : groups.length === 0 ? (
        <EmptyState icon={Building2} title={sp.q ? "No partner groups match." : "No partner packs yet. Upload the first one with its code."} action={!sp.q && <B2bUploadButton />} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {groups.map((g) => (
            <GroupCard
              key={g.id}
              g={g}
              balances={balances}
              partnerHasLogo={g.partner_code ? (partnerHasLogo.get(g.partner_code) ?? false) : false}
              extra={
                <div>
                  <p className="micro-label mb-1">Partner pack</p>
                  {g.source === "b2b" ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="min-w-0 text-mr-body">
                        {g.pack_path ? (
                          <>
                            <span className="font-mono">{g.pack_file_name ?? "pack.pdf"}</span>
                            {g.pack_uploaded_at ? ` · uploaded ${formatDateTime(g.pack_uploaded_at)}${g.uploader?.display_name ? ` by ${g.uploader.display_name}` : ""}` : ""}
                            {g.partner_reference ? ` · their code ${g.partner_reference}` : ""}
                            {" · "}
                            <a href={`/api/groups/${g.id}/b2b-pack`} className="text-mr-muted hover:text-mr-ink hover:underline">
                              original file
                            </a>
                          </>
                        ) : (
                          <span className="text-mr-warning">No pack file yet</span>
                        )}
                      </span>
                      <ReplaceB2bPackButton groupId={g.id} label={g.pack_path ? "Replace pack" : "Upload pack"} />
                    </div>
                  ) : (
                    <p className="text-xs text-mr-body">Our own group for {g.partner_code}: documents are compiled here from the travellers above.</p>
                  )}
                </div>
              }
            />
          ))}
        </div>
      )}
    </>
  );
}
