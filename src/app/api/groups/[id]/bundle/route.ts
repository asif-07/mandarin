import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { launchBrowser } from "@/lib/pdf/browser";
import { buildGroupBundle, type BundleLogo } from "@/lib/pdf/group-bundle";
import { markGroupVisaApplied } from "@/lib/travel/visa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/groups/:id/bundle?logo=mr|partner|none
 * Streams "visa + all documents" for a group as one PDF. For B2B groups the
 * logo choice picks the cover branding (partner logo when on file, plain
 * partner name, or Mandarin Roots). Downloading marks the group visa applied.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const current = await getCurrentProfile();
  if (!current) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const raw = request.nextUrl.searchParams.get("logo");
  const logo: BundleLogo | undefined = raw === "mr" || raw === "partner" || raw === "none" ? raw : undefined;
  const supabase = await createClient();

  let browser;
  try {
    browser = await launchBrowser();
    const built = await buildGroupBundle(supabase, browser, id, { logo, includeVisa: true });
    await markGroupVisaApplied(supabase, built.groupId);
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
