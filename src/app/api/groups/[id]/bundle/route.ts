import { NextResponse, after, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { launchBrowser } from "@/lib/pdf/browser";
import { buildGroupBundle, findCachedBundle, type BundleLogo } from "@/lib/pdf/group-bundle";
import { BUCKETS } from "@/lib/constants";
import { markGroupVisaApplied } from "@/lib/travel/visa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/groups/:id/bundle?logo=mr|partner|none
 * Streams "visa + all documents" for a group as one PDF. For B2B groups the
 * logo choice picks the cover branding (partner logo when on file, plain
 * partner name, or Mandarin Roots). Downloading marks the group visa applied.
 *
 * Bundles are cached in storage under a key derived from everything that
 * affects their content, so repeat downloads of an unchanged group redirect
 * to a signed URL instantly instead of rendering again.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const current = await getCurrentProfile();
  if (!current) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const raw = request.nextUrl.searchParams.get("logo");
  const logo: BundleLogo | undefined = raw === "mr" || raw === "partner" || raw === "none" ? raw : undefined;
  const supabase = await createClient();

  const cached = await findCachedBundle(supabase, id, { logo }).catch(() => null);
  if (cached) {
    const { data: signed } = await supabase.storage.from(BUCKETS.travelPacks).createSignedUrl(cached.path, 300, { download: cached.fileName });
    if (signed) {
      await markGroupVisaApplied(supabase, id);
      return NextResponse.redirect(signed.signedUrl, { status: 302 });
    }
  }

  let browser;
  try {
    browser = await launchBrowser();
    const built = await buildGroupBundle(supabase, browser, id, { logo, includeVisa: true });
    await markGroupVisaApplied(supabase, built.groupId);
    // Store the result for next time, after the response has been sent.
    after(async () => {
      const { error } = await supabase.storage.from(BUCKETS.travelPacks).upload(built.cachePath, Buffer.from(built.bytes), { contentType: "application/pdf", upsert: true });
      if (error) console.error("bundle cache write failed", error.message);
    });
    return new NextResponse(Buffer.from(built.bytes), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${built.fileName}"`,
        "cache-control": "no-store",
        "x-pack-warnings": encodeURIComponent(built.warnings.join(" | ")).slice(0, 2000),
      },
    });
  } catch (e) {
    console.error("group bundle failed", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not build the bundle" }, { status: 500 });
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
