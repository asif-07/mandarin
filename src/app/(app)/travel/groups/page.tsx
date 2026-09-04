import type { Metadata } from "next";
import { Suspense } from "react";
import { Layers } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { GroupsList, GroupsToolbar, type GroupRow } from "@/components/travel/groups-manager";
import { Pagination } from "@/components/shared/pagination";
import { pageRange, parsePage } from "@/lib/pagination";
import { SearchParamInput } from "@/components/shared/url-filters";
import { createClient } from "@/lib/supabase/server";
import { dateRangeForQuery } from "@/lib/actions/travel-groups";

export const metadata: Metadata = { title: "Travel groups" };

export default async function GroupsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const [from, to] = pageRange(page, 50);
  const supabase = await createClient();

  let query = supabase
    .from("travel_groups")
    .select("id, travel_date, travel_end_date, group_code, label, guide_name, notes, reference_prefix, created_at, travellers(count), creator:profiles!travel_groups_created_by_fkey(display_name)", { count: "exact" })
    .order("travel_date", { ascending: false })
    .order("group_code", { ascending: true })
    .range(from, to);
  if (sp.q) {
    const q = sp.q.trim();
    const range = await dateRangeForQuery(q);
    if (range) query = query.gte("travel_date", range[0]).lte("travel_date", range[1]);
    else {
      const like = `%${q.replace(/[%,]/g, "")}%`;
      query = query.or(`group_code.ilike.${like},label.ilike.${like},guide_name.ilike.${like}`);
    }
  }
  const { data, count, error } = await query;

  const groups: GroupRow[] = (data ?? []).map((g) => ({
    id: g.id,
    travel_date: g.travel_date,
    travel_end_date: g.travel_end_date,
    group_code: g.group_code,
    label: g.label,
    guide_name: g.guide_name,
    notes: g.notes,
    reference_prefix: g.reference_prefix,
    traveller_count: Array.isArray(g.travellers) ? Number(g.travellers[0]?.count ?? 0) : 0,
    created_by_name: g.creator?.display_name ?? null,
    created_at: g.created_at,
  }));

  return (
    <>
      <PageHeader title="Travel groups" description="Each group has a travel window and a code. Codes are unique per start date, so G01 can exist on every date." actions={<GroupsToolbar />} />
      <Suspense>
        <div className="mb-4">
          <SearchParamInput placeholder="Search date (2026-10-15), code or label" className="md:w-80" />
        </div>
      </Suspense>
      {error ? (
        <p className="text-sm text-mr-red">Could not load groups: {error.message}</p>
      ) : groups.length === 0 ? (
        <EmptyState icon={Layers} title={sp.q ? "No groups match." : "No travel groups yet. Bulk-create a day's groups in one go."} action={!sp.q && <GroupsToolbar />} />
      ) : (
        <>
          <GroupsList groups={groups} />
          <Suspense>
            <Pagination page={page} total={count ?? 0} pageSize={50} />
          </Suspense>
        </>
      )}
    </>
  );
}
