import { NextResponse } from "next/server";
import JSZip from "jszip";
import { formatInTimeZone } from "date-fns-tz";
import { createClient } from "@/lib/supabase/server";
import { launchBrowser } from "@/lib/pdf/browser";
import { compileTravelPack } from "@/lib/pdf/travel-pack";
import { BUCKETS, TIMEZONE } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/groups/:id/packs -> { url, count, warnings }
 * Compiles a fresh pack for every traveller in the group (one shared browser),
 * zips them, stores the ZIP in the travel-packs bucket and returns a signed URL.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: group } = await supabase
    .from("travel_groups")
    .select("id, travel_date, group_code, travellers(id, full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
  if (group.travellers.length === 0) return NextResponse.json({ error: "This group has no travellers" }, { status: 400 });

  let browser;
  const warnings: string[] = [];
  try {
    browser = await launchBrowser();
    const zip = new JSZip();
    for (const t of group.travellers) {
      try {
        const result = await compileTravelPack(supabase, browser, t.id, user.id);
        const { data: file, error } = await supabase.storage.from(BUCKETS.travelPacks).download(result.storagePath);
        if (error || !file) throw new Error(error?.message ?? "download failed");
        zip.file(result.fileName, await file.arrayBuffer());
        warnings.push(...result.warnings.map((w) => `${t.full_name}: ${w}`));
      } catch (e) {
        warnings.push(`${t.full_name}: pack failed (${e instanceof Error ? e.message : "error"})`);
      }
    }

    const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    const stamp = formatInTimeZone(new Date(), TIMEZONE, "yyyyMMdd-HHmmss");
    const fileName = `${group.travel_date}-${group.group_code}-travel-packs-${stamp}.zip`;
    const storagePath = `_groups/${group.id}/${fileName}`;
    const { error: upError } = await supabase.storage
      .from(BUCKETS.travelPacks)
      .upload(storagePath, bytes, { contentType: "application/zip", upsert: false });
    if (upError) throw new Error(`Upload failed: ${upError.message}`);

    const { data: signed, error: signError } = await supabase.storage
      .from(BUCKETS.travelPacks)
      .createSignedUrl(storagePath, 300, { download: fileName });
    if (signError || !signed) throw new Error("Could not create download link");

    return NextResponse.json({ url: signed.signedUrl, count: group.travellers.length, warnings });
  } catch (e) {
    console.error("group packs failed", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Compilation failed", warnings }, { status: 500 });
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
