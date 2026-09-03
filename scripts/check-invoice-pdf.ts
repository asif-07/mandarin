/**
 * Golden-file check for the invoice PDF.
 *
 * Renders the reference invoice (MR-2026-179) through the real HTML template
 * and Puppeteer, then asserts:
 *   - exactly one A4 page
 *   - page size is A4 (595.28 x 841.89 pt, +-1pt)
 *   - the amount-in-words helper produces the expected wording
 *
 * Writes invoice-check.pdf and invoice-check.png next to this script's output
 * directory (OUT_DIR env, default ./tmp) for a visual comparison.
 *
 * Usage: PUPPETEER_EXECUTABLE_PATH=/path/to/chrome npx tsx scripts/check-invoice-pdf.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { config } from "dotenv";
import { renderInvoiceHtml, type InvoiceTemplateData } from "../src/lib/pdf/invoice-template";
import { htmlToPdf, launchBrowser } from "../src/lib/pdf/browser";
import { loadTemplateAssets } from "../src/lib/pdf/assets";
import { amountInWords } from "../src/lib/invoice/amount-in-words";
import { DEFAULT_TERMS } from "../src/lib/constants";

config({ path: ".env.local" });

const OUT_DIR = process.env.OUT_DIR ?? path.join(process.cwd(), "tmp");

export const REFERENCE_INVOICE: InvoiceTemplateData = {
  invoice_number: "MR-2026-179",
  issue_date: "2026-08-22",
  due_date_label: "On Receipt",
  currency: "USD",
  bill_to_name: "Shareer Shahudeen",
  bill_to_phone: "+971 55 472 0259",
  bill_to_email: null,
  bill_to_address: null,
  items: [
    {
      title: "Visa Charges",
      description: "Visa application and processing fee",
      reference: "MR144-Aug25-Aug30-05px-G01",
      quantity: 1,
      rate: 140,
      amount: 140,
    },
    {
      title: "Service Charges",
      description: "Documentation, coordination and handling",
      reference: null,
      quantity: 1,
      rate: 80,
      amount: 80,
    },
  ],
  subtotal: 220,
  tax: 0,
  total: 220,
  amount_in_words: amountInWords(220, "USD"),
  terms: DEFAULT_TERMS,
};

function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`ok   ${msg}`);
  }
}

async function main() {
  assert(amountInWords(220, "USD") === "US Dollars Two Hundred and Twenty Only", "220 USD wording");
  assert(
    amountInWords(220.5, "USD") === "US Dollars Two Hundred and Twenty and Fifty Cents Only",
    "220.50 USD wording",
  );
  assert(amountInWords(1250, "AED") === "UAE Dirhams One Thousand Two Hundred and Fifty Only", "1250 AED wording");
  assert(amountInWords(250000, "INR") === "Indian Rupees Two Lakh Fifty Thousand Only", "2.5 lakh INR wording");
  assert(amountInWords(1005.25, "CNY") === "Chinese Yuan One Thousand and Five and Twenty-Five Fen Only", "CNY wording");

  const assets = await loadTemplateAssets();
  const html = renderInvoiceHtml(REFERENCE_INVOICE, assets);
  const pdf = await htmlToPdf(html);

  const doc = await PDFDocument.load(pdf);
  const pages = doc.getPageCount();
  assert(pages === 1, `single A4 page (got ${pages})`);
  const { width, height } = doc.getPage(0).getSize();
  assert(Math.abs(width - 595.28) < 1 && Math.abs(height - 841.89) < 1, `A4 size (${width.toFixed(2)} x ${height.toFixed(2)} pt)`);

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, "invoice-check.pdf"), pdf);

  // PNG snapshot for eyeballing against the reference design.
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: ["load", "networkidle0"] });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await page.screenshot({ path: path.join(OUT_DIR, "invoice-check.png"), fullPage: true });
  } finally {
    await browser.close();
  }
  console.log(`wrote ${path.join(OUT_DIR, "invoice-check.pdf")} and .png`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
