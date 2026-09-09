import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { BUCKETS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/groups/:id/b2b-pack -> short-lived signed download of the partner's compiled pack, under our file name. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const current = await getCurrentProfile();
  if (!current) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const supabase = await createClient();
  const { data: group } = await supabase.from("travel_groups").select("pack_path, pack_file_name").eq("id", id).maybeSingle();
  if (!group?.pack_path) return NextResponse.json({ error: "No partner pack on this group" }, { status: 404 });
  const { data: signed, error } = await supabase.storage
    .from(BUCKETS.travelPacks)
    .createSignedUrl(group.pack_path, 120, { download: group.pack_file_name ?? "group-pack.pdf" });
  if (error || !signed) return NextResponse.json({ error: "Could not create download link" }, { status: 500 });
  return NextResponse.redirect(signed.signedUrl, { status: 302 });
}
