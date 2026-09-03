import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BUCKETS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/packs/:id -> redirect to a short-lived signed download of a previously compiled pack. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: pack } = await supabase.from("travel_packs").select("storage_path").eq("id", id).maybeSingle();
  if (!pack) return NextResponse.json({ error: "Pack not found" }, { status: 404 });

  const fileName = pack.storage_path.split("/").pop() ?? "travel-pack.pdf";
  const { data: signed, error } = await supabase.storage
    .from(BUCKETS.travelPacks)
    .createSignedUrl(pack.storage_path, 120, { download: fileName });
  if (error || !signed) return NextResponse.json({ error: "Could not create download link" }, { status: 500 });
  return NextResponse.redirect(signed.signedUrl, { status: 302 });
}
