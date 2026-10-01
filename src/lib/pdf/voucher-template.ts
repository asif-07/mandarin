import { COMPANY, GROUND_BRAND, TRANSFER_MODES, labelFor } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { FONT_STACK } from "@/lib/pdf/fonts";
import { escapeHtml, type TemplateAssets } from "@/lib/pdf/invoice-template";

export type VoucherData = {
  voucher_no: string; // MR144-SEP23-SEP28-G01-TV01
  group_ref: string;
  group_code: string;
  label: string | null;
  partner_code: string | null;
  partner_name: string | null;
  guide_name: string | null;
  travel_start_date: string;
  travel_end_date: string;
  service_name: string;
  from_place: string | null;
  to_place: string | null;
  service_date: string | null;
  pax: number | null;
  transfer_mode: string | null;
  notes: string | null;
  travellers: { full_name: string; passport_number: string | null }[];
  generated_at: Date;
  /** active | redeemed | cancelled; anything but active is stamped across the voucher. */
  status?: string;
  /** Data URI of the QR code (the secure token URL); omitted on previews. */
  qr_src?: string | null;
  /** Partner name shown top-left when the group is B2B and no logo is on file. */
  brand_name?: string | null;
};

/**
 * One-page transfer voucher in the pack cover's design language. Branding
 * follows the group: the partner's logo (or name) for a B2B group, Mandarin
 * Roots for our own clients; China Travel Support is the neutral ground brand
 * in the footer. The QR carries only the secure token: the partner scanner
 * fetches the live record, the printed details are for the customer.
 */
export function renderTransferVoucherHtml(data: VoucherData, assets: Pick<TemplateAssets, "logoSrc" | "fontCss">): string {
  const status = data.status ?? "active";
  const rows: [string, string][] = [
    ["Voucher No.", data.voucher_no],
    ["Status", status === "active" ? "ACTIVE" : status.toUpperCase()],
    ["Service", data.service_name],
    ["From", data.from_place ?? "—"],
    ["To", data.to_place ?? "—"],
    ["Transfer Date", data.service_date ? formatDate(data.service_date) : "—"],
    ["Pax", data.pax ? String(data.pax) : "—"],
    ["Transfer Mode", data.transfer_mode ? labelFor(TRANSFER_MODES, data.transfer_mode) : "—"],
    ["Group", `${data.group_ref}${data.label ? ` · ${data.label}` : ""}`],
    ...(data.partner_code ? ([["Partner", `${data.partner_code}${data.partner_name ? ` · ${data.partner_name}` : ""}`]] as [string, string][]) : []),
    ["Travel Dates", `${formatDate(data.travel_start_date)} – ${formatDate(data.travel_end_date)}`],
    ["Guide", data.guide_name ?? "—"],
    ["Issued On", formatDateTime(data.generated_at)],
  ];
  const list = data.travellers
    .map(
      (t, i) => `
      <tr>
        <td class="idx">${String(i + 1).padStart(2, "0")}</td>
        <td><div class="t">${escapeHtml(t.full_name)}</div></td>
        <td class="num">${escapeHtml(t.passport_number ?? "—")}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(data.voucher_no)}</title>
<style>
${assets.fontCss}
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: ${FONT_STACK}; font-size: 8.07pt; line-height: 1.5; color: #1A1A1A; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-variant-numeric: tabular-nums; }
  .page { width: 210mm; height: 297mm; padding: 36px 40px 30px 40px; position: relative; overflow: hidden; display: flex; flex-direction: column; }
  .micro { font-size: 5.76pt; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: #9A9A9A; line-height: 1.2; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; }
  .header img.logo { width: 168px; max-height: 64px; height: auto; display: block; object-fit: contain; object-position: left top; }
  .title { text-align: right; padding-top: 5px; }
  .title .word { font-size: 16pt; font-weight: 700; letter-spacing: 4.6px; line-height: 1.15; margin-right: -4.6px; }
  .title .ref { font-size: 6.34pt; letter-spacing: 1.85px; color: #8A8A8A; margin-top: 3.5px; margin-right: -1.85px; }
  .rule { border-top: 1.6px solid #1A1A1A; margin-top: 21px; }
  .route { margin-top: 40px; display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; width: 68%; }
  .route .place { font-size: 20pt; font-weight: 700; line-height: 1.2; }
  .route .arrow { font-size: 16pt; color: #E8192C; }
  .when { margin-top: 6px; font-size: 10pt; color: #5C5C5C; }
  .when b { color: #1A1A1A; }
  .kv-block { margin-top: 24px; width: 62%; }
  .kv { display: flex; justify-content: space-between; gap: 12px; font-size: 8.07pt; padding: 5px 0; border-bottom: 1px solid #ECECEC; }
  .kv .k { color: #8A8A8A; }
  .kv .v { font-weight: 700; text-align: right; }
  .contents { margin-top: 30px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { font-size: 5.76pt; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: #9A9A9A; text-align: left; padding: 0 0 8px 0; border-bottom: 1.15px solid #1A1A1A; }
  td { padding: 7px 0; border-bottom: 1px solid #ECECEC; vertical-align: middle; }
  td.idx { width: 8%; color: #5C5C5C; }
  td .t { font-weight: 700; }
  td.num, th.num { text-align: right; color: #5C5C5C; width: 24%; }
  .notes { margin-top: 20px; background: #F7F7F7; padding: 12px 15px; }
  .notes .body { font-size: 7.49pt; color: #1A1A1A; margin-top: 4px; white-space: pre-wrap; }
  .present { margin-top: 24px; font-size: 7.49pt; color: #5C5C5C; }
  .footer { margin-top: auto; display: flex; justify-content: space-between; font-size: 6.34pt; color: #8A8A8A; border-top: 1px solid #CFCFCF; padding-top: 8px; }
  .bar { position: absolute; left: 0; top: 0; width: 6px; height: 100%; background: #E8192C; }
  .header .brand { font-size: 14pt; font-weight: 700; letter-spacing: 0.5px; padding-top: 6px; min-height: 24px; }
  .qr { position: absolute; right: 40px; top: 120px; width: 150px; text-align: center; }
  .qr img { width: 150px; height: 150px; display: block; image-rendering: pixelated; }
  .qr-note { font-size: 5.76pt; letter-spacing: 0.12em; text-transform: uppercase; color: #8A8A8A; margin-top: 4px; line-height: 1.4; }
  .stamp { position: absolute; left: 50%; top: 45%; transform: translate(-50%, -50%) rotate(-18deg); font-size: 44pt; font-weight: 700; letter-spacing: 8px; color: rgba(232, 25, 44, 0.18); border: 4px solid rgba(232, 25, 44, 0.18); padding: 6px 24px; border-radius: 10px; }
</style>
</head>
<body>
<div class="page">
  <div class="bar"></div>
  <div class="header">
    ${assets.logoSrc ? `<img class="logo" src="${assets.logoSrc}" alt="${escapeHtml(data.brand_name ?? "Mandarin Roots")}" />` : `<div class="brand">${escapeHtml(data.brand_name ?? "")}</div>`}
    <div class="title">
      <div class="word">TRANSFER VOUCHER</div>
      <div class="ref">${escapeHtml(data.voucher_no)}</div>
    </div>
  </div>
  <div class="rule"></div>
  ${status !== "active" ? `<div class="stamp">${escapeHtml(status.toUpperCase())}</div>` : ""}
  ${data.qr_src ? `<div class="qr"><img src="${data.qr_src}" alt="Voucher QR" /><div class="qr-note">Scan by authorised<br/>${escapeHtml(GROUND_BRAND.name)} partner</div></div>` : ""}
  <div class="route">
    <span class="place">${escapeHtml(data.from_place ?? "—")}</span>
    <span class="arrow">→</span>
    <span class="place">${escapeHtml(data.to_place ?? "—")}</span>
  </div>
  <div class="when">${data.service_date ? `<b>${escapeHtml(formatDate(data.service_date))}</b>` : ""}${data.pax ? ` · <b>${data.pax} pax</b>` : ""}${data.transfer_mode ? ` · ${escapeHtml(labelFor(TRANSFER_MODES, data.transfer_mode))}` : ""}</div>
  <div class="kv-block">
    ${rows.map(([k, v]) => `<div class="kv"><span class="k">${escapeHtml(k)}</span><span class="v">${escapeHtml(v)}</span></div>`).join("")}
  </div>
  ${
    data.travellers.length
      ? `<div class="contents">
    <div class="micro">Passengers</div>
    <table>
      <thead><tr><th>#</th><th>Name</th><th class="num">Passport</th></tr></thead>
      <tbody>${list}</tbody>
    </table>
  </div>`
      : ""
  }
  ${data.notes ? `<div class="notes"><div class="micro">Notes</div><div class="body">${escapeHtml(data.notes)}</div></div>` : ""}
  <div class="present">Please present this voucher at the meeting point. The ground partner scans the QR code to verify it; it can be used once. For assistance call ${escapeHtml(COMPANY.phone)}.</div>
  <div class="footer">
    <span>Ground service by ${escapeHtml(GROUND_BRAND.name)}${data.brand_name ? "" : ` · ${escapeHtml(COMPANY.name)} · ${escapeHtml(COMPANY.phone)}`}</span>
    <span>${escapeHtml(data.voucher_no)}</span>
  </div>
</div>
</body>
</html>`;
}
