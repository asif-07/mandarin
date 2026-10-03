import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVisaMember } from "@/lib/portal/auth";
import { launchBrowser } from "@/lib/pdf/browser";
import { buildGroupBundle } from "@/lib/pdf/group-bundle";
import { recordEvent } from "@/lib/workflow/engine";
import { BUCKETS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET — the complete application for the Visa Team: the partner's bulk PDF
 * when the group was submitted with one, otherwise the compiled group pack
 * (Mandarin Roots cover + every traveller's documents) built on the fly.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const member = await getVisaMember();
  if (!member) return NextResponse.json({ error: "Visa Team sign-in required" }, { status: 401 });
  const { id } = await params;
  const supabase = createAdminClient();
  const { data: g } = await supabase.from("travel_groups").select("id, workflow_status, pack_path, pack_file_name").eq("id", id).maybeSingle();
  if (!g || !g.workflow_status) return NextResponse.json({ error: "Group not found" }, { status: 404 });
  await recordEvent(supabase, id, { kind: "visa_team", name: `${member.name} (${member.code})` }, "Application downloaded by the Visa Team");
  if (g.pack_path) {
    const { data: signed, error } = await supabase.storage.from(BUCKETS.travelPacks).createSignedUrl(g.pack_path, 120, { download: g.pack_file_name ?? "application.pdf" });
    if (error || !signed) return NextResponse.json({ error: "Could not create download link" }, { status: 500 });
    return NextResponse.redirect(signed.signedUrl, { status: 302 });
  }
  let browser;
  try {
    browser = await launchBrowser();
    const built = await buildGroupBundle(supabase, browser, id, { logo: "mr", includeVisa: false, scope: "all" });
    return new NextResponse(Buffer.from(built.bytes), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${built.fileName}"`, "cache-control": "no-store" } });
  } catch (e) {
    console.error("visa team application failed", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not build the application" }, { status: 500 });
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
