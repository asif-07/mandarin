import { COMPANY } from "@/lib/constants";
import { formatDate, formatNumber, padIndex } from "@/lib/format";
import { CJK_FALLBACK_HREF, FONT_STACK } from "@/lib/pdf/fonts";

/** Data needed to render an invoice. Pure input so the same template runs in the browser preview and in Puppeteer. */
export type InvoiceTemplateData = {
  invoice_number: string;
  issue_date: string; // yyyy-MM-dd
  due_date_label: string;
  currency: string;
  bill_to_name: string;
  bill_to_phone?: string | null;
  bill_to_email?: string | null;
  bill_to_address?: string | null;
  items: {
    title: string;
    description?: string | null;
    reference?: string | null;
    quantity: number;
    rate: number;
    amount: number;
  }[];
  subtotal: number;
  tax: number;
  total: number;
  amount_in_words: string;
  terms?: string | null;
};

export type TemplateAssets = {
  /** URL or data URI for the logo lockup */
  logoSrc: string;
  /** URL or data URI for the signature PNG */
  signatureSrc: string;
  /** @font-face rules (data URIs on the server, /fonts URLs in the browser) */
  fontCss: string;
};

export function escapeHtml(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function lines(text: string | null | undefined): string[] {
  return (text ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/*
 * All measurements below were taken from the reference PDF
 * (Mandarin_Roots_Invoice_MR2026179.pdf) with PyMuPDF and converted from
 * points to CSS pixels (1pt = 1.3333px) on a 794px-wide A4 page.
 */
export function renderInvoiceHtml(data: InvoiceTemplateData, assets: TemplateAssets): string {
  const money = (n: number) => `${escapeHtml(data.currency)} ${formatNumber(n)}`;
  const billToLines = [data.bill_to_phone, ...lines(data.bill_to_address), data.bill_to_email]
    .filter((v): v is string => !!v && v.trim().length > 0)
    .map((l) => `<div>${escapeHtml(l)}</div>`)
    .join("");

  const rows = data.items
    .map((it, i) => {
      const sub: string[] = [];
      if (it.description) sub.push(`<div class="sub">${escapeHtml(it.description)}</div>`);
      if (it.reference) sub.push(`<div class="sub">Visa Ref: ${escapeHtml(it.reference)}</div>`);
      return `
        <tr>
          <td class="idx">${padIndex(i + 1)}</td>
          <td class="desc"><div class="t">${escapeHtml(it.title)}</div>${sub.join("")}</td>
          <td class="num">${escapeHtml(formatNumber(it.quantity, Number.isInteger(it.quantity) ? 0 : 2))}</td>
          <td class="num">${escapeHtml(formatNumber(it.rate))}</td>
          <td class="num amt">${escapeHtml(formatNumber(it.amount))}</td>
        </tr>`;
    })
    .join("");

  const termLines = lines(data.terms)
    .map((l) => `<div>${escapeHtml(l)}</div>`)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(data.invoice_number)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="${CJK_FALLBACK_HREF}" rel="stylesheet" />
<style>
${assets.fontCss}
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    font-family: ${FONT_STACK};
    font-size: 8.07pt;
    line-height: 1.5;
    color: #1A1A1A;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    font-variant-numeric: tabular-nums;
    -webkit-font-smoothing: antialiased;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 36px 40px 30px 40px;
    margin: 0 auto;
    position: relative;
    overflow: hidden;
  }
  .micro {
    font-size: 5.76pt;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #9A9A9A;
    line-height: 1.2;
  }
  .header { display: flex; justify-content: space-between; align-items: flex-start; }
  .header img.logo { width: 168px; height: auto; display: block; margin-top: 0; }
  .title { text-align: right; padding-top: 5px; }
  .title .word {
    font-size: 20.75pt;
    font-weight: 700;
    letter-spacing: 4.6px;
    line-height: 1.15;
    margin-right: -4.6px;
  }
  .title .number {
    font-size: 6.34pt;
    font-weight: 400;
    letter-spacing: 1.85px;
    color: #8A8A8A;
    margin-top: 3.5px;
    margin-right: -1.85px;
    line-height: 1.2;
  }
  .rule { border-top: 1.6px solid #1A1A1A; margin-top: 21px; }
  .info { display: flex; margin-top: 22px; }
  .info .c1 { width: 36%; padding-right: 12px; }
  .info .c2 { width: 34%; padding-right: 12px; }
  .info .c3 { width: 30%; padding-top: 3px; }
  .info .micro { margin-bottom: 6px; }
  .info .name { font-size: 8.64pt; font-weight: 700; margin-bottom: 2px; }
  .info .grey { color: #5C5C5C; }
  .kv { display: flex; justify-content: space-between; gap: 12px; font-size: 7.49pt; padding: 3.25px 0; }
  .kv .k { color: #8A8A8A; }
  .kv .v { font-weight: 700; text-align: right; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 32.5px; }
  table.items th {
    font-size: 5.76pt; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: #9A9A9A;
    text-align: left; padding: 0 0 8.7px 0; border-bottom: 1.15px solid #1A1A1A; line-height: 1.2;
  }
  table.items td { padding: 11.5px 0; border-bottom: 1px solid #ECECEC; vertical-align: middle; }
  table.items td.desc { vertical-align: top; }
  table.items td.num { text-align: right; color: #5C5C5C; }
  table.items td.idx { color: #5C5C5C; }
  table.items td.desc .t { font-weight: 700; }
  table.items td.desc .sub { font-size: 6.92pt; color: #8A8A8A; line-height: 1.5; margin-top: 1px; }
  table.items td.amt { font-weight: 700; color: #1A1A1A; }
  .totals { display: flex; margin-top: 18.5px; align-items: flex-end; }
  .totals .left { width: 52%; padding-right: 24px; }
  .totals .left .micro { margin-bottom: 6px; }
  .totals .left .words { font-size: 7.49pt; font-style: italic; color: #5C5C5C; }
  .totals .right { width: 48%; }
  .totals .row { display: flex; justify-content: space-between; padding: 4.7px 0; }
  .totals .row .k { color: #5C5C5C; }
  .totals .bar {
    display: flex; justify-content: space-between; align-items: center;
    background: #E8192C; color: #fff; font-weight: 700; font-size: 9.8pt; line-height: 1.5;
    padding: 10px 13.5px; margin-top: 9px;
  }
  .terms { margin-top: 22.5px; background: #F7F7F7; padding: 15px 15.3px 15.7px; }
  .terms .micro { margin-bottom: 4px; }
  .terms .body { font-size: 7.49pt; color: #5C5C5C; line-height: 1.56; }
  .footer { display: flex; margin-top: 33px; align-items: flex-start; }
  .footer .left { width: 58%; font-size: 6.34pt; color: #8A8A8A; line-height: 1.64; padding-right: 24px; }
  .footer .right { width: 42%; }
  .footer img.sig { height: 67.7px; width: auto; display: block; margin-left: 4.5px; margin-bottom: -6.3px; position: relative; z-index: 1; }
  .footer .sigline { border-top: 1px solid #CFCFCF; padding-top: 7px; font-size: 6.92pt; color: #5C5C5C; line-height: 1.2; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <img class="logo" src="${assets.logoSrc}" alt="Mandarin Roots" />
    <div class="title">
      <div class="word">INVOICE</div>
      <div class="number">${escapeHtml(data.invoice_number)}</div>
    </div>
  </div>

  <div class="rule"></div>

  <div class="info">
    <div class="c1">
      <div class="micro">From</div>
      <div class="name">${escapeHtml(COMPANY.name)}</div>
      <div class="grey">${escapeHtml(COMPANY.addressLine1)}</div>
      <div class="grey">${escapeHtml(COMPANY.addressLine2)}</div>
      <div class="grey">${escapeHtml(COMPANY.addressLine3)}</div>
      <div class="grey">${escapeHtml(COMPANY.phone)}</div>
    </div>
    <div class="c2">
      <div class="micro">Bill To</div>
      <div class="name">${escapeHtml(data.bill_to_name)}</div>
      <div class="grey">${billToLines}</div>
    </div>
    <div class="c3">
      <div class="kv"><span class="k">Invoice No.</span><span class="v">${escapeHtml(data.invoice_number)}</span></div>
      <div class="kv"><span class="k">Issue Date</span><span class="v">${escapeHtml(formatDate(data.issue_date))}</span></div>
      <div class="kv"><span class="k">Due Date</span><span class="v">${escapeHtml(data.due_date_label)}</span></div>
      <div class="kv"><span class="k">Currency</span><span class="v">${escapeHtml(data.currency)}</span></div>
    </div>
  </div>

  <table class="items">
    <colgroup>
      <col style="width:8%" /><col style="width:52%" /><col style="width:10%" /><col style="width:15%" /><col style="width:15%" />
    </colgroup>
    <thead>
      <tr>
        <th>#</th>
        <th>Description</th>
        <th>Qty</th>
        <th>Rate</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div class="left">
      <div class="micro">Amount in Words</div>
      <div class="words">${escapeHtml(data.amount_in_words)}</div>
    </div>
    <div class="right">
      <div class="row"><span class="k">Subtotal</span><span>${money(data.subtotal)}</span></div>
      <div class="row"><span class="k">Tax</span><span>${money(data.tax)}</span></div>
      <div class="bar"><span>Total Due</span><span>${money(data.total)}</span></div>
    </div>
  </div>

  <div class="terms">
    <div class="micro">Terms &amp; Conditions</div>
    <div class="body">${termLines}</div>
  </div>

  <div class="footer">
    <div class="left">
      <div>Thank you for your business.</div>
      <div>For questions about this invoice, contact ${escapeHtml(COMPANY.phone)}.</div>
    </div>
    <div class="right">
      <img class="sig" src="${assets.signatureSrc}" alt="" />
      <div class="sigline">Authorised Signatory, ${escapeHtml(COMPANY.name)}</div>
    </div>
  </div>
</div>
</body>
</html>`;
}
