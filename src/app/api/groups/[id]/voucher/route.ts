import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { htmlToPdf } from "@/lib/pdf/browser";
import { loadTemplateAssets } from "@/lib/pdf/assets";
import { renderTransferVoucherHtml } from "@/lib/pdf/voucher-template";
import { groupRef } from "@/lib/queries/travel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/groups/:id/voucher?service=<group_service_id>
 * Prints the transfer voucher for one airport transfer attached to the group,
 * from the details entered once on the group (from, to, date, pax, mode).
 * The voucher number is the Group ID plus TV01, TV02 … in the group's
 * service order, so a group with several transfers gets one voucher each.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const current = await getCurrentProfile();
  if (!current) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const serviceId = request.nextUrl.searchParams.get("service");
  if (!serviceId) return NextResponse.json({ error: "Which transfer? Pass ?service=<id>" }, { status: 400 });
  const supabase = await createClient();

  const [{ data: group }, { data: services }] = await Promise.all([
    supabase
      .from("travel_groups")
      .select("id, travel_date, travel_end_date, group_code, label, guide_name, reference_prefix, partner_code, group_ref, travellers(full_name, passport_number, status)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("group_services").select("id, service_name, kind, from_place, to_place, service_date, pax, transfer_mode, notes, position").eq("group_id", id).order("position").order("created_at"),
  ]);
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
  const transfers = (services ?? []).filter((s) => s.kind === "airport_transfer");
  const index = transfers.findIndex((s) => s.id === serviceId);
  const service = index >= 0 ? transfers[index]! : null;
  if (!service) return NextResponse.json({ error: "That transfer is not on this group" }, { status: 404 });

  const { data: partner } = group.partner_code ? await supabase.from("b2b_partners").select("name").eq("code", group.partner_code).maybeSingle() : { data: null };
  const ref = group.group_ref ?? groupRef(group);
  const voucherNo = `${ref}-TV${String(index + 1).padStart(2, "0")}`;
  const travellers = (group.travellers ?? [])
    .filter((t) => t.status !== "cancelled")
    .sort((a, b) => a.full_name.localeCompare(b.full_name))
    .map((t) => ({ full_name: t.full_name, passport_number: t.passport_number }));

  try {
    const html = renderTransferVoucherHtml(
      {
        voucher_no: voucherNo,
        group_ref: ref,
        group_code: group.group_code,
        label: group.label,
        partner_code: group.partner_code,
        partner_name: partner?.name ?? null,
        guide_name: group.guide_name,
        travel_start_date: group.travel_date,
        travel_end_date: group.travel_end_date,
        service_name: service.service_name,
        from_place: service.from_place,
        to_place: service.to_place,
        service_date: service.service_date,
        pax: service.pax,
        transfer_mode: service.transfer_mode,
        notes: service.notes,
        travellers,
        generated_at: new Date(),
      },
      await loadTemplateAssets(),
    );
    const pdf = await htmlToPdf(html);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${voucherNo}.pdf"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    console.error("transfer voucher failed", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not build the voucher" }, { status: 500 });
  }
}
