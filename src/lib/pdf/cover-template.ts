import { COMPANY } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { CJK_FALLBACK_HREF, FONT_STACK } from "@/lib/pdf/fonts";
import { escapeHtml, type TemplateAssets } from "@/lib/pdf/invoice-template";

export type CoverData = {
  traveller_ref: string;
  full_name: string;
  passport_number: string | null;
  nationality: string | null;
  travel_start_date: string;
  travel_end_date: string;
  group_code: string | null;
  group_label: string | null;
  visa_reference: string | null;
  generated_at: Date;
  contents: { label: string; file_name: string; pages: number }[];
  missing: string[];
};

/** Branded cover page for the travel document pack, in the invoice's design language. */
export function renderCoverHtml(data: CoverData, assets: Pick<TemplateAssets, "logoSrc" | "fontCss">): string {
  const rows: [string, string][] = [
    ["Traveller", data.full_name],
    ["Reference", data.traveller_ref],
    ["Passport No.", data.passport_number ?? "—"],
    ["Nationality", data.nationality ?? "—"],
    ["Travel Dates", `${formatDate(data.travel_start_date)} – ${formatDate(data.travel_end_date)}`],
    ["Group", data.group_code ? `${data.group_code}${data.group_label ? ` · ${data.group_label}` : ""}` : "—"],
    ["Visa Reference", data.visa_reference ?? "—"],
    ["Generated On", formatDateTime(data.generated_at)],
  ];

  const contents = data.contents
    .map(
      (c, i) => `
      <tr>
        <td class="idx">${String(i + 1).padStart(2, "0")}</td>
        <td><div class="t">${escapeHtml(c.label)}</div><div class="sub">${escapeHtml(c.file_name)}</div></td>
        <td class="num">${c.pages} page${c.pages === 1 ? "" : "s"}</td>
      </tr>`,
    )
    .join("");

  const missing = data.missing.length
    ? `<div class="missing"><div class="micro">Not included</div><div class="body">${data.missing.map((m) => escapeHtml(m)).join(", ")}</div></div>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(data.traveller_ref)} - Travel Pack</title>
<link href="${CJK_FALLBACK_HREF}" rel="stylesheet" />
<style>
${assets.fontCss}
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: ${FONT_STACK}; font-size: 8.07pt; line-height: 1.5; color: #1A1A1A; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-variant-numeric: tabular-nums; }
  .page { width: 210mm; height: 297mm; padding: 36px 40px 30px 40px; position: relative; overflow: hidden; display: flex; flex-direction: column; }
  .micro { font-size: 5.76pt; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: #9A9A9A; line-height: 1.2; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; }
  .header img.logo { width: 168px; height: auto; display: block; }
  .title { text-align: right; padding-top: 5px; }
  .title .word { font-size: 16pt; font-weight: 700; letter-spacing: 4.6px; line-height: 1.15; margin-right: -4.6px; }
  .title .ref { font-size: 6.34pt; letter-spacing: 1.85px; color: #8A8A8A; margin-top: 3.5px; margin-right: -1.85px; }
  .rule { border-top: 1.6px solid #1A1A1A; margin-top: 21px; }
  .name { font-size: 20pt; font-weight: 700; margin-top: 40px; line-height: 1.2; }
  .kv-block { margin-top: 24px; width: 62%; }
  .kv { display: flex; justify-content: space-between; gap: 12px; font-size: 8.07pt; padding: 5px 0; border-bottom: 1px solid #ECECEC; }
  .kv .k { color: #8A8A8A; }
  .kv .v { font-weight: 700; text-align: right; }
  .contents { margin-top: 36px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { font-size: 5.76pt; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: #9A9A9A; text-align: left; padding: 0 0 8px 0; border-bottom: 1.15px solid #1A1A1A; }
  td { padding: 9px 0; border-bottom: 1px solid #ECECEC; vertical-align: middle; }
  td.idx { width: 8%; color: #5C5C5C; }
  td .t { font-weight: 700; }
  td .sub { font-size: 6.92pt; color: #8A8A8A; }
  td.num, th.num { text-align: right; color: #5C5C5C; width: 18%; }
  .missing { margin-top: 20px; background: #F7F7F7; padding: 12px 15px; }
  .missing .body { font-size: 7.49pt; color: #B87503; margin-top: 4px; }
  .footer { margin-top: auto; display: flex; justify-content: space-between; font-size: 6.34pt; color: #8A8A8A; border-top: 1px solid #CFCFCF; padding-top: 8px; }
  .bar { position: absolute; left: 0; top: 0; width: 6px; height: 100%; background: #E8192C; }
</style>
</head>
<body>
<div class="page">
  <div class="bar"></div>
  <div class="header">
    <img class="logo" src="${assets.logoSrc}" alt="Mandarin Roots" />
    <div class="title">
      <div class="word">TRAVEL DOCUMENT PACK</div>
      <div class="ref">${escapeHtml(data.traveller_ref)}</div>
    </div>
  </div>
  <div class="rule"></div>

  <div class="name">${escapeHtml(data.full_name)}</div>
  <div class="kv-block">
    ${rows.map(([k, v]) => `<div class="kv"><span class="k">${escapeHtml(k)}</span><span class="v">${escapeHtml(v)}</span></div>`).join("")}
  </div>

  <div class="contents">
    <div class="micro">Contents</div>
    <table>
      <thead><tr><th>#</th><th>Document</th><th class="num">Pages</th></tr></thead>
      <tbody>${contents}</tbody>
    </table>
    ${missing}
  </div>

  <div class="footer">
    <span>${escapeHtml(COMPANY.name)} · ${escapeHtml(COMPANY.addressLine3)} · ${escapeHtml(COMPANY.phone)}</span>
    <span>Confidential · contains personal identity documents</span>
  </div>
</div>
</body>
</html>`;
}
