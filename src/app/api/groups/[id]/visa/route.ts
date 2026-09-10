import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { BUCKETS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/groups/:id/visa -> short-lived signed download of the group's visa page. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const current = await getCurrentProfile();
  if (!current) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const supabase = await createClient();
  const { data: group } = await supabase.from("travel_groups").select("visa_path, visa_file_name").eq("id", id).maybeSingle();
  if (!group?.visa_path) return NextResponse.json({ error: "No visa uploaded for this group" }, { status: 404 });
  const { data: signed, error } = await supabase.storage.from(BUCKETS.travelPacks).createSignedUrl(group.visa_path, 120, { download: group.visa_file_name ?? "visa.pdf" });
  if (error || !signed) return NextResponse.json({ error: "Could not create download link" }, { status: 500 });
  return NextResponse.redirect(signed.signedUrl, { status: 302 });
}
