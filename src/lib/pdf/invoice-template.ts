import { COMPANY } from "@/lib/constants";
import { formatDate, formatNumber, padIndex } from "@/lib/format";

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

export const INVOICE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Poppins:wght@600;700&family=Noto+Sans+SC:wght@400;700&display=block";

/**
 * Returns the full HTML document for an invoice. A4, zero page margins; all
 * spacing is carried by the .page padding so Puppeteer output matches the
 * on-screen preview exactly.
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
<link href="${INVOICE_FONTS_HREF}" rel="stylesheet" />
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    font-family: "Inter", "Noto Sans SC", "Helvetica Neue", Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.55;
    color: #1A1A1A;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    font-variant-numeric: tabular-nums;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 46px 52px 40px 52px;
    margin: 0 auto;
    position: relative;
  }
  .cjk { font-family: "Noto Sans SC", "Inter", sans-serif; }
  .micro {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #9A9A9A;
    line-height: 1.2;
  }
  .header { display: flex; justify-content: space-between; align-items: flex-start; }
  .header img.logo { width: 218px; height: auto; display: block; }
  .title { text-align: right; }
  .title .word {
    font-family: "Poppins", "Inter", sans-serif;
    font-size: 27pt;
    font-weight: 700;
    letter-spacing: 6px;
    line-height: 1;
    margin-right: -6px;
  }
  .title .number {
    font-size: 8pt;
    font-weight: 400;
    letter-spacing: 2.4px;
    color: #8A8A8A;
    margin-top: 6px;
    margin-right: -2.4px;
  }
  .rule { border-top: 2px solid #1A1A1A; margin-top: 26px; }
  .info { display: flex; margin-top: 26px; }
  .info .c1 { width: 36%; padding-right: 16px; }
  .info .c2 { width: 34%; padding-right: 16px; }
  .info .c3 { width: 30%; }
  .info .micro { margin-bottom: 8px; }
  .info .name { font-weight: 700; }
  .info .grey { color: #5C5C5C; }
  .kv { display: flex; justify-content: space-between; gap: 12px; }
  .kv .k { color: #8A8A8A; }
  .kv .v { font-weight: 700; text-align: right; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 34px; }
  table.items th {
    font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #9A9A9A;
    text-align: left; padding: 0 0 10px 0; border-bottom: 1.5px solid #1A1A1A;
  }
  table.items th.num, table.items td.num { text-align: right; }
  table.items td { padding: 15px 0; border-bottom: 1px solid #ECECEC; vertical-align: top; }
  table.items td.idx { color: #5C5C5C; }
  table.items td.desc .t { font-weight: 700; }
  table.items td.desc .sub { font-size: 9pt; color: #8A8A8A; line-height: 1.5; }
  table.items td.amt { font-weight: 700; }
  .totals { display: flex; margin-top: 24px; align-items: flex-end; }
  .totals .left { width: 52%; padding-right: 24px; }
  .totals .left .words { font-size: 9.5pt; font-style: italic; color: #5C5C5C; margin-top: 8px; }
  .totals .right { width: 48%; }
  .totals .row { display: flex; justify-content: space-between; padding: 5px 0; }
  .totals .row .k { color: #5C5C5C; }
  .totals .bar {
    display: flex; justify-content: space-between; align-items: center;
    background: #E8192C; color: #fff; font-weight: 700; font-size: 12.5pt;
    padding: 13px 18px; margin-top: 10px;
  }
  .terms { margin-top: 30px; background: #F7F7F7; padding: 18px 20px; }
  .terms .micro { margin-bottom: 8px; }
  .terms .body { font-size: 9.5pt; color: #5C5C5C; }
  .footer { display: flex; margin-top: 44px; align-items: flex-end; }
  .footer .left { width: 58%; font-size: 8.5pt; color: #8A8A8A; padding-right: 24px; }
  .footer .right { width: 42%; text-align: right; }
  .footer img.sig { height: 88px; width: auto; display: inline-block; margin-bottom: -14px; position: relative; z-index: 1; }
  .footer .sigline { border-top: 1px solid #CFCFCF; padding-top: 8px; font-size: 9pt; color: #5C5C5C; }
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
      <div class="grey cjk">${escapeHtml(COMPANY.addressLine1)}</div>
      <div class="grey cjk">${escapeHtml(COMPANY.addressLine2)}</div>
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
        <th class="num">Qty</th>
        <th class="num">Rate</th>
        <th class="num">Amount</th>
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
      <div>${escapeHtml(COMPANY.name)} · ${escapeHtml(COMPANY.phone)} · ${escapeHtml(COMPANY.email)}</div>
    </div>
    <div class="right">
      <img class="sig" src="${assets.signatureSrc}" alt="" />
      <div class="sigline">
        <div>Authorised Signatory</div>
        <div>${escapeHtml(COMPANY.name)}</div>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;
}
