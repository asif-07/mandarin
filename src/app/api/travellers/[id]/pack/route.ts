import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { launchBrowser } from "@/lib/pdf/browser";
import { compileTravelPack } from "@/lib/pdf/travel-pack";
import { BUCKETS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST /api/travellers/:id/pack -> { url, page_count, warnings } */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  let browser;
  try {
    browser = await launchBrowser();
    const result = await compileTravelPack(supabase, browser, id, user.id);
    const { data: signed, error } = await supabase.storage
      .from(BUCKETS.travelPacks)
      .createSignedUrl(result.storagePath, 120, { download: result.fileName });
    if (error || !signed) throw new Error("Could not create download link");
    return NextResponse.json({ url: signed.signedUrl, page_count: result.pageCount, warnings: result.warnings, pack_id: result.packId });
  } catch (e) {
    console.error("travel pack failed", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Compilation failed" }, { status: 500 });
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
