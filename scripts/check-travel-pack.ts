/**
 * Local check for the travel pack compiler (no Supabase needed).
 * Builds a pack from: a generated portrait JPG (passport), a landscape PNG
 * (hotel booking) and a real PDF (the invoice golden file, standing in for a
 * PAR), then asserts page count, A4 page sizes and PDF metadata.
 *
 * Usage: PUPPETEER_EXECUTABLE_PATH=/path/to/chrome npx tsx scripts/check-travel-pack.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { config } from "dotenv";
import { launchBrowser, htmlToPdf } from "../src/lib/pdf/browser";
import { buildTravelPackPdf } from "../src/lib/pdf/travel-pack";
import { renderInvoiceHtml } from "../src/lib/pdf/invoice-template";
import { loadTemplateAssets } from "../src/lib/pdf/assets";
import { REFERENCE_INVOICE } from "./check-invoice-pdf";

config({ path: ".env.local" });
const OUT_DIR = process.env.OUT_DIR ?? path.join(process.cwd(), "tmp");

function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
  } else console.log(`ok   ${msg}`);
}

async function main() {
  const passportJpg = await sharp({ create: { width: 1200, height: 1700, channels: 3, background: "#d9c9a3" } })
    .jpeg()
    .toBuffer();
  const hotelPng = await sharp({ create: { width: 1800, height: 900, channels: 4, background: "#cfe3ff" } })
    .png()
    .toBuffer();
  const parPdf = await htmlToPdf(renderInvoiceHtml(REFERENCE_INVOICE, await loadTemplateAssets()));

  const browser = await launchBrowser();
  try {
    const built = await buildTravelPackPdf(
      browser,
      {
        id: "test",
        traveller_ref: "TR-2026-0001",
        full_name: "Shareer Shahudeen",
        passport_number: "N1234567",
        nationality: "Indian",
        travel_start_date: "2026-08-25",
        travel_end_date: "2026-08-30",
        visa_reference: "MR144-Aug25-Aug30-05px-G01",
        group_code: "G01",
        group_label: "Canton Phase 1",
      },
      [
        { docId: "1", docType: "par", fileName: "par.pdf", mimeType: "application/pdf", bytes: new Uint8Array(parPdf) },
        { docId: "2", docType: "passport", fileName: "passport.jpg", mimeType: "image/jpeg", bytes: new Uint8Array(passportJpg) },
        { docId: "4", docType: "hotel_booking", fileName: "hotel.png", mimeType: "image/png", bytes: new Uint8Array(hotelPng) },
        { docId: "5", docType: "other", fileName: "broken.pdf", mimeType: "application/pdf", bytes: new Uint8Array([1, 2, 3]) },
      ],
    );

    assert(built.pageCount === 4, `cover + 3 documents = 4 pages (got ${built.pageCount})`);
    assert(built.warnings.length === 1 && built.warnings[0]!.includes("broken.pdf"), `unreadable file is skipped with a warning (${built.warnings.join("; ")})`);
    assert(built.includedDocIds.join(",") === "1,2,4", "included doc ids follow merge order");

    const doc = await PDFDocument.load(built.bytes);
    assert(doc.getTitle() === "TR-2026-0001 - Shareer Shahudeen - Travel Pack", `metadata title (${doc.getTitle()})`);
    const sizes = doc.getPages().map((p) => p.getSize());
    assert(
      sizes.every((s) => Math.abs(s.width - 595.28) < 1 && Math.abs(s.height - 841.89) < 1),
      `every page is A4 (${sizes.map((s) => `${s.width.toFixed(0)}x${s.height.toFixed(0)}`).join(", ")})`,
    );

    await mkdir(OUT_DIR, { recursive: true });
    await writeFile(path.join(OUT_DIR, "travel-pack-check.pdf"), built.bytes);
    console.log(`wrote ${path.join(OUT_DIR, "travel-pack-check.pdf")}`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
