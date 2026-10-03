import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPortalPartner } from "@/lib/portal/auth";
import { BUCKETS, WORKFLOW_ORDER } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?kind=pack|visa|stamped — signed download for the partner's own group, gated by the workflow stage. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const partner = await getPortalPartner();
  if (!partner) return NextResponse.json({ error: "Partner sign-in required" }, { status: 401 });
  const { id } = await params;
  const kind = request.nextUrl.searchParams.get("kind");
  const supabase = createAdminClient();
  const { data: g } = await supabase.from("travel_groups").select("partner_code, workflow_status, pack_path, pack_file_name, visa_path, visa_file_name, stamped_visa_path, stamped_visa_file_name, stamped_visa_shared").eq("id", id).maybeSingle();
  if (!g || g.partner_code !== partner.code) return NextResponse.json({ error: "Group not found" }, { status: 404 });
  const stage = g.workflow_status ? WORKFLOW_ORDER.indexOf(g.workflow_status as never) : -1;
  let path: string | null = null;
  let name = "file";
  if (kind === "pack") (path = g.pack_path), (name = g.pack_file_name ?? "pack.pdf");
  else if (kind === "visa" && g.visa_path && (g.workflow_status === null || stage >= WORKFLOW_ORDER.indexOf("visa_approved"))) (path = g.visa_path), (name = g.visa_file_name ?? "visa.pdf");
  else if (kind === "stamped" && g.stamped_visa_path && g.stamped_visa_shared) (path = g.stamped_visa_path), (name = g.stamped_visa_file_name ?? "stamped-visa");
  if (!path) return NextResponse.json({ error: "Not available" }, { status: 404 });
  const { data: signed, error } = await supabase.storage.from(BUCKETS.travelPacks).createSignedUrl(path, 120, { download: name });
  if (error || !signed) return NextResponse.json({ error: "Could not create download link" }, { status: 500 });
  return NextResponse.redirect(signed.signedUrl, { status: 302 });
}
