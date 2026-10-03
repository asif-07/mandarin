import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { BUCKETS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/groups/:id/stamped-visa -> signed download of the stamped entry visa copy (CRM staff). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const current = await getCurrentProfile();
  if (!current) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const supabase = await createClient();
  const { data: g } = await supabase.from("travel_groups").select("stamped_visa_path, stamped_visa_file_name").eq("id", id).maybeSingle();
  if (!g?.stamped_visa_path) return NextResponse.json({ error: "No stamped visa copy on this group" }, { status: 404 });
  const { data: signed, error } = await supabase.storage.from(BUCKETS.travelPacks).createSignedUrl(g.stamped_visa_path, 120, { download: g.stamped_visa_file_name ?? "stamped-visa" });
  if (error || !signed) return NextResponse.json({ error: "Could not create download link" }, { status: 500 });
  return NextResponse.redirect(signed.signedUrl, { status: 302 });
}
