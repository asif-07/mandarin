import { NextResponse } from "next/server";
import { formatInTimeZone } from "date-fns-tz";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { launchBrowser } from "@/lib/pdf/browser";
import { buildGroupBundle } from "@/lib/pdf/group-bundle";
import { markGroupVisaApplied } from "@/lib/travel/visa";
import { BUCKETS, TIMEZONE } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/groups/:id/packs -> { url, file_name, page_count, count, warnings }
 * Builds ONE merged PDF for the group (group cover, the visa page if received,
 * then every traveller's documents in PAR, passport, flight, hotel order),
 * named like MR144-Aug25-Aug30-05px-G01.pdf, stores it in the travel-packs
 * bucket and returns a signed download URL. Downloading marks the group as
 * visa applied.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const current = await getCurrentProfile();
  if (!current) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const supabase = await createClient();

  let browser;
  try {
    browser = await launchBrowser();
    const built = await buildGroupBundle(supabase, browser, id, { logo: "mr", includeVisa: true });

    const stamp = formatInTimeZone(new Date(), TIMEZONE, "yyyyMMdd-HHmmss");
    const storagePath = `_groups/${built.groupId}/${stamp}/${built.fileName}`;
    const { error: upError } = await supabase.storage
      .from(BUCKETS.travelPacks)
      .upload(storagePath, Buffer.from(built.bytes), { contentType: "application/pdf", upsert: false });
    if (upError) throw new Error(`Upload failed: ${upError.message}`);

    const { data: signed, error: signError } = await supabase.storage
      .from(BUCKETS.travelPacks)
      .createSignedUrl(storagePath, 300, { download: built.fileName });
    if (signError || !signed) throw new Error("Could not create download link");

    await markGroupVisaApplied(supabase, built.groupId);
    return NextResponse.json({ url: signed.signedUrl, file_name: built.fileName, page_count: built.pageCount, count: built.travellerCount, warnings: built.warnings });
  } catch (e) {
    console.error("group pack failed", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Compilation failed" }, { status: 500 });
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
