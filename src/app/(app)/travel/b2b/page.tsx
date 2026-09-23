import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Building2, Download } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { B2bUploadButton, ReplaceB2bPackButton } from "@/components/travel/b2b-upload";
import { GroupRowActions } from "@/components/travel/groups-manager";
import { DownloadBundleButton, GroupVisaPanel } from "@/components/travel/group-visa";
import { MarkPaidButton } from "@/components/invoices/mark-paid-button";
import { GroupDocuments } from "@/components/travel/group-documents";
import { PartnersButton } from "@/components/travel/partner-logos";
import { BUCKETS, INVOICE_STATUSES, labelFor, packageDetail } from "@/lib/constants";
import { SearchParamInput } from "@/components/shared/url-filters";
import { createClient } from "@/lib/supabase/server";
import { groupPackReference } from "@/lib/queries/travel";
import { daysFromToday, formatDateRange, formatDateTime, formatMoney, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "B2B groups" };

export default async function B2bGroupsPage({ searchParams }: { searchParams: Promise<{ q?: string; all?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("travel_groups")
    .select(
      "id, travel_date, travel_end_date, group_code, label, guide_name, notes, reference_prefix, entry_port, exit_port, source, partner_code, partner_reference, pax_expected, pack_path, pack_file_name, pack_uploaded_at, package_tier, hotel_name, hotel_stars, transit_location, visa_status, visa_applied_at, visa_uploaded_at, visa_path, uploader:profiles!travel_groups_pack_uploaded_by_fkey(display_name), travellers(count), invoices:invoices!invoices_travel_group_id_fkey(id, invoice_number, total, currency, status), group_documents(id, doc_type, file_name, file_size, uploaded_at, deleted_at)",
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
  const timing = (g: { travel_date: string; travel_end_date: string }) => {
    const start = daysFromToday(g.travel_date) ?? 0;
    const end = daysFromToday(g.travel_end_date) ?? 0;
    if (end < 0) return { text: end === -1 ? "Returned yesterday" : `Returned ${-end} days ago`, tone: "past" as const };
    if (start <= 0) return { text: end === 0 ? "Travelling now · returns today" : `Travelling now · ${end} day${end === 1 ? "" : "s"} left`, tone: "now" as const };
    if (start === 1) return { text: "Travelling tomorrow", tone: "soon" as const };
    return { text: `Travelling in ${start} days`, tone: start <= 7 ? ("soon" as const) : ("later" as const) };
  };
  const logoPaths = (partnerRows ?? []).map((p) => p.logo_path).filter((p): p is string => !!p);
  const { data: signedLogos } = logoPaths.length ? await supabase.storage.from(BUCKETS.partnerLogos).createSignedUrls(logoPaths, 3600) : { data: [] as { path: string | null; signedUrl: string }[] };
  const logoUrl = new Map((signedLogos ?? []).map((s) => [s.path, s.signedUrl]));
  const partners = (partnerRows ?? []).map((p) => ({ ...p, logo_url: p.logo_path ? (logoUrl.get(p.logo_path) ?? null) : null }));
  const partnerHasLogo = new Map(partners.map((p) => [p.code, !!p.logo_path]));

  const byPartner = new Map<string, number>();
  groups.forEach((g) => byPartner.set(g.partner_code ?? "?", (byPartner.get(g.partner_code ?? "?") ?? 0) + 1));

  return (
    <>
      <PageHeader
        title="B2B partner groups"
        description="Packs compiled by partner agencies. Upload their PDF with their code; it is filed under the next free group number for that date, renamed to our reference, and appears in the calendar and group views."
        actions={
          <>
            <PartnersButton partners={partners} />
            <B2bUploadButton />
          </>
        }
      />
      <Suspense>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <SearchParamInput placeholder="Search partner, code or label" className="md:w-80" />
          {byPartner.size > 0 && (
            <span className="text-xs text-mr-muted">
              {[...byPartner.entries()].map(([p, n]) => `${p} ${n}`).join(" · ")}
            </span>
          )}
        </div>
      </Suspense>

      {error ? (
        <p className="text-sm text-mr-red">Could not load groups: {error.message}</p>
      ) : groups.length === 0 ? (
        <EmptyState icon={Building2} title={sp.q ? "No partner groups match." : "No partner packs yet. Upload the first one with its code."} action={!sp.q && <B2bUploadButton />} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {groups.map((g) => {
            const pax = g.pax_expected ?? 0;
            const reference = groupPackReference(g, pax);
            const when = timing(g);
            return (
              <li key={g.id} className={cn("rounded-lg border bg-white p-5", when.tone === "now" ? "border-mr-ink" : when.tone === "past" ? "border-mr-line opacity-80" : "border-mr-line")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="tnum text-sm font-medium text-mr-body">{formatDateRange(g.travel_date, g.travel_end_date)}</p>
                    <span
                      className={cn(
                        "mt-1 inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
                        when.tone === "now" ? "bg-mr-ink text-white" : when.tone === "soon" ? "bg-mr-warning/10 text-mr-warning" : when.tone === "past" ? "bg-mr-surface text-mr-muted" : "bg-mr-surface text-mr-body",
                      )}
                    >
                      {when.text}
                    </span>
                    <Link href={`/travel?date=${g.travel_date}`} className="mt-0.5 block truncate font-heading text-xl font-semibold text-mr-ink hover:underline">
                      {g.group_code} <span className="font-sans text-base font-normal text-mr-body">· {g.partner_code}</span>
                    </Link>
                    {g.label && <p className="truncate text-sm text-mr-body">{g.label}</p>}
                  </div>
                  <GroupRowActions
                    group={{
                      id: g.id,
                      travel_date: g.travel_date,
                      travel_end_date: g.travel_end_date,
                      group_code: g.group_code,
                      label: g.label,
                      guide_name: g.guide_name,
                      notes: g.notes,
                      reference_prefix: g.reference_prefix,
                      entry_port: g.entry_port,
                      exit_port: g.exit_port,
                      package_tier: g.package_tier,
                      hotel_name: g.hotel_name,
                      hotel_stars: g.hotel_stars,
                      transit_location: g.transit_location,
                      source: g.source,
                      partner_code: g.partner_code,
                      pax_expected: g.pax_expected,
                      traveller_count: Array.isArray(g.travellers) ? Number(g.travellers[0]?.count ?? 0) : 0,
                      created_by_name: null,
                      created_at: null,
                    }}
                  />
                </div>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="micro-label">Pax</p>
                    <p className="tnum mt-1 font-heading text-3xl font-semibold leading-none text-mr-ink">{pax}</p>
                  </div>
                  <div className="text-right text-xs text-mr-muted">
                    <p>Their code</p>
                    <p className="font-mono text-mr-body">{g.partner_reference}</p>
                  </div>
                </div>
                <p className="mt-3 flex flex-wrap items-center gap-x-2 border-t border-mr-line pt-3 text-xs">
                  {g.invoices.filter((i) => i.status !== "cancelled").length ? (
                    <>
                      <span className="rounded-md bg-mr-success/10 px-1.5 py-0.5 font-medium text-mr-success">Invoice generated</span>
                      {g.invoices
                        .filter((i) => i.status !== "cancelled")
                        .map((i) => (
                          <span key={i.id} className="inline-flex items-center gap-2">
                            <Link href={`/invoices/${i.id}`} className="text-mr-body hover:text-mr-ink hover:underline">
                              {i.invoice_number} · {formatMoney(i.total, i.currency)} · {labelFor(INVOICE_STATUSES, i.status)}
                            </Link>
                            {i.status === "issued" && <MarkPaidButton invoiceId={i.id} invoiceNumber={i.invoice_number} />}
                          </span>
                        ))}
                    </>
                  ) : (
                    <>
                      <span className="rounded-md bg-mr-warning/10 px-1.5 py-0.5 font-medium text-mr-warning">No invoice yet</span>
                      <Link href={`/invoices/new?group=${g.id}`} className="text-mr-body hover:text-mr-ink hover:underline">
                        + Create invoice
                      </Link>
                    </>
                  )}
                </p>
                <p className="mt-2 break-all font-mono text-xs text-mr-ink">{reference}.pdf</p>
                <p className="mt-1 truncate text-xs text-mr-muted">
                  {g.entry_port && g.exit_port ? `In: ${g.entry_port} · Out: ${g.exit_port}` : <span className="text-mr-warning">Entry / exit port missing</span>}
                  {g.package_tier ? ` · ${packageDetail(g.package_tier, g.hotel_stars, g.hotel_name, g.transit_location)}` : ""}
                  {g.pack_uploaded_at ? ` · uploaded ${formatDateTime(g.pack_uploaded_at)}${g.uploader?.display_name ? ` by ${g.uploader.display_name}` : ""}` : ""}
                </p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  {g.pack_path ? (
                    <span className="flex items-center gap-3">
                      <DownloadBundleButton
                        variant="default"
                        group={{
                          id: g.id,
                          source: g.source,
                          partner_code: g.partner_code,
                          visa_status: g.visa_status,
                          visa_applied_at: g.visa_applied_at,
                          visa_uploaded_at: g.visa_uploaded_at,
                          visa_path: g.visa_path,
                          pack_path: g.pack_path,
                          traveller_count: Array.isArray(g.travellers) ? Number(g.travellers[0]?.count ?? 0) : 0,
                          partner_has_logo: g.partner_code ? (partnerHasLogo.get(g.partner_code) ?? false) : false,
                        }}
                      />
                      <a href={`/api/groups/${g.id}/b2b-pack`} className="text-xs text-mr-muted hover:text-mr-ink hover:underline">
                        Original file
                      </a>
                    </span>
                  ) : g.source === "b2b" ? (
                    <span className="text-xs text-mr-warning">No pack file</span>
                  ) : (
                    <span className="text-xs text-mr-body">Own group · documents compiled here</span>
                  )}
                  {g.source === "b2b" ? <ReplaceB2bPackButton groupId={g.id} label={g.pack_path ? "Replace" : "Upload pack"} /> : <span className="text-xs text-mr-muted">Compiled by us for {g.partner_code}</span>}
                </div>
                <div className="mt-3 border-t border-mr-line pt-3">
                  <GroupDocuments groupId={g.id} documents={(g.group_documents ?? []).filter((d) => !d.deleted_at)} />
                </div>
                <div className="mt-3 border-t border-mr-line pt-3">
                  <GroupVisaPanel
                    group={{
                      id: g.id,
                      source: g.source,
                      partner_code: g.partner_code,
                      visa_status: g.visa_status,
                      visa_applied_at: g.visa_applied_at,
                      visa_uploaded_at: g.visa_uploaded_at,
                      visa_path: g.visa_path,
                      pack_path: g.pack_path,
                      traveller_count: Array.isArray(g.travellers) ? Number(g.travellers[0]?.count ?? 0) : 0,
                      partner_has_logo: g.partner_code ? (partnerHasLogo.get(g.partner_code) ?? false) : false,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
