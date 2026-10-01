import { NextResponse, type NextRequest } from "next/server";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { htmlToPdf } from "@/lib/pdf/browser";
import { loadTemplateAssets } from "@/lib/pdf/assets";
import { renderTransferVoucherHtml } from "@/lib/pdf/voucher-template";
import { BUCKETS } from "@/lib/constants";
import { groupRef } from "@/lib/queries/travel";
import { scannerBaseUrl } from "@/lib/scanner/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function mimeFromName(name: string | null | undefined): string {
  return (name ?? "").toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
}

/**
 * GET /api/vouchers/:id/pdf
 * The customer-facing transfer voucher: group details pulled in at issue
 * time, branded for the partner (B2B) or Mandarin Roots (own client), with a
 * QR that holds only the secure token for the China Travel Support scanner.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const current = await getCurrentProfile();
  if (!current) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const supabase = await createClient();
  const { data: v } = await supabase
    .from("transfer_vouchers")
    .select("*, group:travel_groups!transfer_vouchers_group_id_fkey(id, travel_date, travel_end_date, group_code, label, guide_name, reference_prefix, partner_code, source, group_ref, travellers(full_name, passport_number, status))")
    .eq("id", id)
    .maybeSingle();
  if (!v || !v.group) return NextResponse.json({ error: "Voucher not found" }, { status: 404 });
  const group = v.group;

  // Branding: B2B group -> partner logo (name when no logo on file); own client -> Mandarin Roots.
  const assets = await loadTemplateAssets();
  let logoSrc: string = assets.logoSrc;
  let brandName: string | null = null;
  if (group.partner_code) {
    const { data: partner } = await supabase.from("b2b_partners").select("name, logo_path, logo_file_name").eq("code", group.partner_code).maybeSingle();
    brandName = partner?.name || group.partner_code;
    logoSrc = "";
    if (partner?.logo_path) {
      const { data: file } = await supabase.storage.from(BUCKETS.partnerLogos).download(partner.logo_path);
      if (file) logoSrc = `data:${mimeFromName(partner.logo_file_name)};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
    }
  }

  const qrUrl = `${scannerBaseUrl(request)}/scan/v/${v.token}`;
  const qrSrc = await QRCode.toDataURL(qrUrl, { errorCorrectionLevel: "M", margin: 1, width: 300 });
  const travellers = (group.travellers ?? [])
    .filter((t) => t.status !== "cancelled")
    .sort((a, b) => a.full_name.localeCompare(b.full_name))
    .map((t) => ({ full_name: t.full_name, passport_number: t.passport_number }));

  try {
    const html = renderTransferVoucherHtml(
      {
        voucher_no: v.voucher_no,
        group_ref: group.group_ref ?? groupRef(group),
        group_code: group.group_code,
        label: group.label,
        partner_code: group.partner_code,
        partner_name: brandName,
        guide_name: group.guide_name,
        travel_start_date: group.travel_date,
        travel_end_date: group.travel_end_date,
        service_name: "Airport Transfer",
        from_place: v.from_place,
        to_place: v.to_place,
        service_date: v.transfer_date,
        pax: v.pax,
        transfer_mode: v.transfer_mode,
        notes: v.notes,
        travellers,
        generated_at: new Date(v.issued_at),
        status: v.status,
        qr_src: qrSrc,
        brand_name: brandName,
      },
      { logoSrc, fontCss: assets.fontCss },
    );
    const pdf = await htmlToPdf(html);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${v.voucher_no}.pdf"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    console.error("transfer voucher pdf failed", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not build the voucher" }, { status: 500 });
  }
}
