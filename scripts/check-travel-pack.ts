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
import { buildGroupPackPdf, buildTravelPackPdf } from "../src/lib/pdf/travel-pack";
import { groupPackReference } from "../src/lib/queries/travel";
import { parseB2bCode } from "../src/lib/travel/b2b-code";
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
  // B2B partner code parsing: what partners actually send (PAX, leading zeros,
  // letter O for zero, unicode dashes, file names) must all parse; bad parts
  // must be named in the error.
  const today = "2026-09-12";
  const good = [
    "MR144-GKHR-SEP22-SEP27-03PX-G01",
    "MR144-GKHR-SEP22-SEP27-003PX-G01",
    "MR144-GKHR-SEP22-SEP27-03PAX-G01.pdf",
    "MR144-GKHR-SEP22-SEP27-O3PX-GO1",
    "MR144\u2013GKHR\u2013SEP22\u2013SEP27\u201303PX\u2013G01",
    "mr144 gkhr sep22 sep27 3px g1 (1).pdf",
    "MR144_EDPT_OCT15_OCT20_100PX_G01",
    "MR144-GKHR-SEP22-SEP27-03PX.pdf",
  ];
  for (const c of good) {
    const r = parseB2bCode(c, today);
    assert(r.ok, `b2b code parses: ${JSON.stringify(c)}${r.ok ? "" : ` -> ${r.error}`}`);
    if (r.ok && c.includes("GKHR")) assert(r.value.pax === 3 && (r.value.partner_group === "G01" || (r.value.partner_group === null && !/G0?1/.test(c))) && r.value.travel_date === "2026-09-22" && r.value.travel_end_date === "2026-09-27", `b2b code values: ${c}`);
  }
  const bad: [string, RegExp][] = [
    ["MR144-GKHR-SEP22-SEP27", /5 or 6 parts/],
    ["MR144-GKHR-SEPT22-SEP27-03PX-G01", /Entry date/],
    ["MR144-GKHR-SEP22-SEP27-ABC-G01", /Pax/],
    ["MR144-GKHR-SEP22-SEP27-03PX-GA", /Group/],
    ["MR144-GKHR-SEP31-OCT02-03PX-G01", /not a valid date/],
  ];
  for (const [c, re] of bad) {
    const r = parseB2bCode(c, today);
    assert(!r.ok && re.test(r.error), `b2b code error names the part: ${c} -> ${r.ok ? "parsed?!" : r.error}`);
  }

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

    // Group PDF: one group cover, then every traveller's documents (no per-traveller covers), named from the group.
    const group = { travel_date: "2026-08-25", travel_end_date: "2026-08-30", group_code: "G01", reference_prefix: "MR144" };
    const reference = groupPackReference(group, 2);
    assert(reference === "MR144-Aug25-Aug30-02px-G01", `group reference (${reference})`);
    const traveller = {
      id: "t1",
      traveller_ref: "TR-2026-0001",
      full_name: "Shareer Shahudeen",
      passport_number: "N1234567",
      nationality: "Indian",
      travel_start_date: "2026-08-25",
      travel_end_date: "2026-08-30",
      visa_reference: null,
      group_code: "G01",
      group_label: null,
    };
    const groupBuilt = await buildGroupPackPdf(browser, {
      reference,
      group_code: "G01",
      label: null,
      guide_name: "Li Wei",
      travel_start_date: group.travel_date,
      travel_end_date: group.travel_end_date,
      travellers: [
        { traveller, sources: [{ docId: "a", docType: "passport", fileName: "passport.jpg", mimeType: "image/jpeg", bytes: new Uint8Array(passportJpg) }] },
        {
          traveller: { ...traveller, id: "t2", traveller_ref: "TR-2026-0002", full_name: "Fatima Al Mansoori" },
          sources: [{ docId: "b", docType: "par", fileName: "par.pdf", mimeType: "application/pdf", bytes: new Uint8Array(parPdf) }],
        },
      ],
    });
    assert(groupBuilt.pageCount === 3, `group pdf = 1 group cover + 2 x 1 doc = 3 pages (got ${groupBuilt.pageCount})`);
    const gdoc = await PDFDocument.load(groupBuilt.bytes);
    assert(gdoc.getTitle() === `${reference} - Group Travel Pack`, `group metadata title (${gdoc.getTitle()})`);
    await writeFile(path.join(OUT_DIR, `${reference}.pdf`), groupBuilt.bytes);
    console.log(`wrote ${path.join(OUT_DIR, `${reference}.pdf`)}`);

    // B2B-style bundle: partner branding (no Mandarin Roots logo), visa page attached after the cover, then the partner's pack.
    const bundle = await buildGroupPackPdf(browser, {
      reference: "MR144-EDPT-AUG25-AUG30-100PX-G02",
      group_code: "G02",
      label: "EDPT · 100 pax",
      guide_name: null,
      travel_start_date: group.travel_date,
      travel_end_date: group.travel_end_date,
      travellers: [],
      logoSrc: null,
      brand_name: "Edapt Travel",
      partner_code: "EDPT",
      pax_expected: 100,
      package_label: "Visa + Transit + Hotel",
      hotel_name: "Guangzhou Marriott Tianhe",
      visa_label: "Received, attached",
      attachments: [
        { label: "Group visa", bytes: new Uint8Array(parPdf) },
        { label: "EDPT pack (100 pax)", bytes: new Uint8Array(parPdf) },
      ],
    });
    assert(bundle.pageCount === 3, `b2b bundle = cover + visa + pack = 3 pages (got ${bundle.pageCount})`);
    await writeFile(path.join(OUT_DIR, "b2b-bundle-check.pdf"), bundle.bytes);
    console.log(`wrote ${path.join(OUT_DIR, "b2b-bundle-check.pdf")}`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
