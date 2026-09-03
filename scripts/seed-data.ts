/**
 * Uploads sample documents for the travellers seeded by supabase/seed.sql so
 * the document slots, thumbnails and travel pack compiler have real files to
 * work with.
 *
 * Usage:  npx tsx scripts/seed-data.ts
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * Idempotent: SQL uses fixed UUIDs; files are only uploaded for travellers
 * that have no documents yet.
 */
import "dotenv/config";
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", override: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

/** Clearly-labelled placeholder scan (never a real identity document). */
async function sampleJpeg(title: string, name: string, portrait = true): Promise<Buffer> {
  const w = portrait ? 1240 : 1754;
  const h = portrait ? 1754 : 1240;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="100%" height="100%" fill="#f3efe4"/>
    <rect x="60" y="60" width="${w - 120}" height="${h - 120}" fill="none" stroke="#c9c1ad" stroke-width="6" stroke-dasharray="24 16"/>
    <text x="50%" y="42%" font-family="DejaVu Sans, Arial, sans-serif" font-size="72" font-weight="700" fill="#1a1a1a" text-anchor="middle">${title}</text>
    <text x="50%" y="52%" font-family="DejaVu Sans, Arial, sans-serif" font-size="48" fill="#5c5c5c" text-anchor="middle">${name}</text>
    <text x="50%" y="62%" font-family="DejaVu Sans, Arial, sans-serif" font-size="36" fill="#e8192c" text-anchor="middle">SAMPLE SEED DATA - NOT A REAL DOCUMENT</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer();
}

const MERGE_ORDER: Record<string, number> = { par: 1, passport: 2, flight_ticket: 3, hotel_booking: 4, other: 5 };

async function main() {
  // 1. Reference rows come from supabase/seed.sql (already applied to the
  //    project; for a fresh project paste it into the SQL editor first).
  const { data: docProfile } = await admin.from("profiles").select("id").eq("username", "document").single();
  const { data: travellers } = await admin.from("travellers").select("id, traveller_ref, full_name").in("traveller_ref", ["TR-2026-0001", "TR-2026-0002", "TR-2026-0003"]);
  if (!travellers?.length) {
    console.error("Seed travellers not found. Apply supabase/seed.sql first.");
    process.exit(1);
  }

  // 2. Partial document sets: 3/4, 1/4 and 2/4.
  const plan: Record<string, string[]> = {
    "TR-2026-0001": ["par", "passport", "flight_ticket"],
    "TR-2026-0002": ["passport"],
    "TR-2026-0003": ["passport", "hotel_booking"],
  };

  for (const t of travellers) {
    const { count } = await admin.from("traveller_documents").select("id", { count: "exact", head: true }).eq("traveller_id", t.id).is("deleted_at", null);
    if (count && count > 0) {
      console.log(`skip     ${t.traveller_ref} already has ${count} document(s)`);
      continue;
    }
    for (const docType of plan[t.traveller_ref] ?? []) {
      const title = docType.replace("_", " ").toUpperCase();
      const bytes = await sampleJpeg(title, t.full_name, docType !== "hotel_booking");
      const fileName = `${docType}-sample.jpg`;
      const storagePath = `${t.id}/${docType}/${randomUUID()}-${fileName}`;
      const { error: upError } = await admin.storage.from("traveller-documents").upload(storagePath, bytes, { contentType: "image/jpeg" });
      if (upError) throw upError;
      const { error: rowError } = await admin.from("traveller_documents").insert({
        traveller_id: t.id,
        doc_type: docType,
        file_name: fileName,
        storage_path: storagePath,
        mime_type: "image/jpeg",
        file_size: bytes.byteLength,
        merge_order: MERGE_ORDER[docType] ?? 99,
        uploaded_by: docProfile?.id ?? null,
      });
      if (rowError) throw rowError;
      console.log(`uploaded ${t.traveller_ref} ${docType}`);
    }
  }
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
