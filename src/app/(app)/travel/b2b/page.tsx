import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Building2, Download } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { B2bUploadButton, ReplaceB2bPackButton } from "@/components/travel/b2b-upload";
import { GroupRowActions } from "@/components/travel/groups-manager";
import { GroupVisaPanel } from "@/components/travel/group-visa";
import { GroupDocuments } from "@/components/travel/group-documents";
import { PartnerLogosCard } from "@/components/travel/partner-logos";
import { BUCKETS, packageDetail } from "@/lib/constants";
import { SearchParamInput } from "@/components/shared/url-filters";
import { createClient } from "@/lib/supabase/server";
import { groupPackReference } from "@/lib/queries/travel";
import { formatDateRange, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "B2B groups" };

export default async function B2bGroupsPage({ searchParams }: { searchParams: Promise<{ q?: string; all?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("travel_groups")
    .select(
      "id, travel_date, travel_end_date, group_code, label, guide_name, notes, reference_prefix, entry_port, exit_port, source, partner_code, partner_reference, pax_expected, pack_path, pack_file_name, pack_uploaded_at, package_tier, hotel_name, hotel_stars, transit_location, visa_status, visa_applied_at, visa_uploaded_at, visa_path, uploader:profiles!travel_groups_pack_uploaded_by_fkey(display_name), travellers(count), group_documents(id, doc_type, file_name, file_size, uploaded_at, deleted_at)",
    )
    .eq("source", "b2b")
    .order("travel_date", { ascending: false })
    .order("group_code")
    .limit(200);
  if (sp.q) {
    const like = `%${sp.q.trim().replace(/[%,]/g, "")}%`;
    query = query.or(`partner_code.ilike.${like},partner_reference.ilike.${like},group_code.ilike.${like},label.ilike.${like}`);
  }
  const [{ data, error }, { data: partnerRows }] = await Promise.all([query, supabase.from("b2b_partners").select("id, code, name, logo_path, logo_file_name").order("code")]);
  const groups = data ?? [];
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
        actions={<B2bUploadButton />}
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

      <div className="mb-6">
        <PartnerLogosCard partners={partners} />
      </div>

      {error ? (
        <p className="text-sm text-mr-red">Could not load groups: {error.message}</p>
      ) : groups.length === 0 ? (
        <EmptyState icon={Building2} title={sp.q ? "No partner groups match." : "No partner packs yet. Upload the first one with its code."} action={!sp.q && <B2bUploadButton />} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {groups.map((g) => {
            const pax = g.pax_expected ?? 0;
            const reference = groupPackReference(g, pax);
            return (
              <li key={g.id} className="rounded-lg border border-mr-line bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="tnum text-sm font-medium text-mr-body">{formatDateRange(g.travel_date, g.travel_end_date)}</p>
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
                <p className="mt-3 break-all border-t border-mr-line pt-3 font-mono text-xs text-mr-ink">{reference}.pdf</p>
                <p className="mt-1 truncate text-xs text-mr-muted">
                  {g.entry_port && g.exit_port ? `In: ${g.entry_port} · Out: ${g.exit_port}` : <span className="text-mr-warning">Entry / exit port missing</span>}
                  {g.package_tier ? ` · ${packageDetail(g.package_tier, g.hotel_stars, g.hotel_name, g.transit_location)}` : ""}
                  {g.pack_uploaded_at ? ` · uploaded ${formatDateTime(g.pack_uploaded_at)}${g.uploader?.display_name ? ` by ${g.uploader.display_name}` : ""}` : ""}
                </p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  {g.pack_path ? (
                    <a href={`/api/groups/${g.id}/b2b-pack`} className={buttonVariants({ size: "sm" })}>
                      <Download /> Download pack
                    </a>
                  ) : (
                    <span className="text-xs text-mr-warning">No pack file</span>
                  )}
                  <ReplaceB2bPackButton groupId={g.id} label={g.pack_path ? "Replace" : "Upload pack"} />
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
