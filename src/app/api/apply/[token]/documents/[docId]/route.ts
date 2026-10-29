import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { applicationByToken } from "@/lib/apply/server";
import { BUCKETS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — opens one of the application's documents (short-lived signed URL). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string; docId: string }> }) {
  const { token, docId } = await params;
  const app = await applicationByToken(token);
  if (!app) return NextResponse.json({ error: "This link is not valid" }, { status: 404 });
  const supabase = createAdminClient();
  const { data: doc } = await supabase.from("traveller_documents").select("storage_path, traveller:travellers!inner(portal_application_id)").eq("id", docId).is("deleted_at", null).maybeSingle();
  if (!doc || doc.traveller?.portal_application_id !== app.id) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  const { data: signed, error } = await supabase.storage.from(BUCKETS.travellerDocuments).createSignedUrl(doc.storage_path, 120);
  if (error || !signed) return NextResponse.json({ error: "Could not open the file" }, { status: 500 });
  return NextResponse.redirect(signed.signedUrl, { status: 302 });
}
