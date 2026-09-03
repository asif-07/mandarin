import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plane, Plus } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { TravellerTable, type TravellerRow } from "@/components/travel/traveller-table";
import { Pagination, pageRange, parsePage } from "@/components/shared/pagination";
import { ClearFilters, DateRangeParams, SearchParamInput, SelectParam } from "@/components/shared/url-filters";
import { createClient } from "@/lib/supabase/server";
import { docCompleteness, groupTitle } from "@/lib/queries/travel";
import { TRAVELLER_STATUSES } from "@/lib/constants";

export const metadata: Metadata = { title: "Travellers" };

type Search = { q?: string; status?: string; from?: string; to?: string; page?: string };

export default async function TravellersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const [from, to] = pageRange(page);
  const supabase = await createClient();

  let query = supabase
    .from("travellers")
    .select(
      "id, traveller_ref, full_name, travel_start_date, travel_end_date, status, visa_reference, group:travel_groups(travel_date, group_code, label), traveller_documents(doc_type, deleted_at)",
      { count: "exact" },
    )
    .order("travel_start_date", { ascending: false })
    .order("full_name")
    .range(from, to);
  if (sp.status) query = query.eq("status", sp.status);
  if (sp.from) query = query.gte("travel_start_date", sp.from);
  if (sp.to) query = query.lte("travel_start_date", sp.to);
  if (sp.q) {
    const like = `%${sp.q.replace(/[%,]/g, "")}%`;
    query = query.or(`full_name.ilike.${like},traveller_ref.ilike.${like},passport_number.ilike.${like},visa_reference.ilike.${like},phone.ilike.${like}`);
  }
  const { data, count, error } = await query;

  const rows: TravellerRow[] = (data ?? []).map((t) => {
    const c = docCompleteness(t.traveller_documents);
    return {
      id: t.id,
      traveller_ref: t.traveller_ref,
      full_name: t.full_name,
      travel_start_date: t.travel_start_date,
      travel_end_date: t.travel_end_date,
      group_title: t.group ? groupTitle(t.group) : null,
      group_date: t.group?.travel_date ?? null,
      status: t.status,
      docs_count: c.count,
      docs_total: c.total,
      visa_reference: t.visa_reference,
    };
  });
  const hasFilters = !!(sp.q || sp.status || sp.from || sp.to);

  return (
    <>
      <PageHeader
        title="Travellers"
        actions={
          <Link href="/travel/travellers/new" className={buttonVariants()}>
            <Plus /> New traveller
          </Link>
        }
      />
      <Suspense>
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
          <SearchParamInput placeholder="Search name, ref, passport or visa ref" className="md:w-80" />
          <SelectParam name="status" options={TRAVELLER_STATUSES} placeholder="Status" allLabel="All statuses" className="md:w-[190px]" />
          <DateRangeParams />
          <ClearFilters keys={["q", "status", "from", "to"]} />
        </div>
      </Suspense>
      {error ? (
        <p className="text-sm text-mr-red">Could not load travellers: {error.message}</p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Plane}
          title={hasFilters ? "No travellers match these filters." : "No travellers yet. Add one directly or from a won lead."}
          action={
            !hasFilters && (
              <Link href="/travel/travellers/new" className={buttonVariants()}>
                <Plus /> New traveller
              </Link>
            )
          }
        />
      ) : (
        <>
          <TravellerTable rows={rows} />
          <Suspense>
            <Pagination page={page} total={count ?? 0} />
          </Suspense>
        </>
      )}
    </>
  );
}
