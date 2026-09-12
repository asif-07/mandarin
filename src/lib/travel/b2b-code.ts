/**
 * B2B partner pack codes, e.g. MR144-EDPT-OCT15-OCT20-100PX-G01
 *   MR144  our prefix          EDPT  partner code
 *   OCT15  entry date          OCT20 exit date       (no year: inferred)
 *   100PX  number of pax       G01   the partner's own group number
 *
 * Shared by the browser (live preview) and the server (validation), so it
 * has no server-only imports.
 */

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export type ParsedB2bCode = {
  prefix: string;
  partner_code: string;
  travel_date: string; // yyyy-mm-dd
  travel_end_date: string;
  pax: number;
  partner_group: string; // G01 as the partner numbered it
  normalised: string; // the code re-assembled in canonical upper-case form
};

const EXAMPLE = "MR144-EDPT-OCT15-OCT20-100PX-G01";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Letter O typed where a digit belongs ("G0l", "O3PX") is a common slip; read it as zero. */
function digits(s: string): number {
  return Number(s.replace(/O/g, "0"));
}

/**
 * Normalise what people paste or type: unicode dashes and non-breaking
 * spaces from WhatsApp / email, zero-width characters, underscores or spaces
 * as separators, a trailing ".pdf" or " (1)". Result is upper-case with
 * single ASCII dashes between the parts.
 */
export function cleanB2bCode(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, "")
    .replace(/[\u2010-\u2015\u2212\u2043\uFE58\uFE63\uFF0D]/g, "-")
    .replace(/\u00A0/g, " ")
    .trim()
    .replace(/\.pdf$/i, "")
    .replace(/\s*\(\d+\)$/, "")
    .replace(/[_\s]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();
}

const MONTH_RE = /^([A-Z]{3})([0-9O]{1,2})$/;

/**
 * Parse the code. `todayISO` decides the year: the entry date is placed in the
 * current year unless that would be more than 30 days in the past, in which
 * case next year is used. An exit month before the entry month rolls into the
 * following year (DEC28-JAN02). Errors say which part is wrong.
 */
export function parseB2bCode(raw: string, todayISO: string): { ok: true; value: ParsedB2bCode } | { ok: false; error: string } {
  const code = cleanB2bCode(raw);
  if (!code) return { ok: false, error: `Expected a code like ${EXAMPLE}` };
  const parts = code.split("-");
  if (parts.length !== 6) {
    return { ok: false, error: `The code needs 6 parts separated by dashes (prefix, partner, entry date, exit date, pax, group), found ${parts.length}. Example: ${EXAMPLE}` };
  }
  const [prefix, partner, d1Raw, d2Raw, paxRaw, gRaw] = parts as [string, string, string, string, string, string];
  if (!/^[A-Z0-9]{2,12}$/.test(prefix)) return { ok: false, error: `Prefix "${prefix}" should be 2 to 12 letters or digits, e.g. MR144` };
  if (!/^[A-Z0-9]{2,12}$/.test(partner)) return { ok: false, error: `Partner code "${partner}" should be 2 to 12 letters or digits, e.g. EDPT` };

  const m1 = d1Raw.match(MONTH_RE);
  if (!m1) return { ok: false, error: `Entry date "${d1Raw}" should be a three-letter month and day, e.g. OCT15` };
  const m2 = d2Raw.match(MONTH_RE);
  if (!m2) return { ok: false, error: `Exit date "${d2Raw}" should be a three-letter month and day, e.g. OCT20` };
  const mi1 = MONTHS.indexOf(m1[1]!);
  const mi2 = MONTHS.indexOf(m2[1]!);
  if (mi1 === -1) return { ok: false, error: `Unknown month "${m1[1]}" in the entry date (use JAN, FEB, MAR …)` };
  if (mi2 === -1) return { ok: false, error: `Unknown month "${m2[1]}" in the exit date (use JAN, FEB, MAR …)` };
  const day1 = digits(m1[2]!);
  const day2 = digits(m2[2]!);

  const paxM = paxRaw.match(/^([0-9O]{1,5})(?:PX|PAX|P)?$/);
  if (!paxM) return { ok: false, error: `Pax "${paxRaw}" should be a number followed by PX, e.g. 100PX or 03PX` };
  const pax = digits(paxM[1]!);
  if (!pax) return { ok: false, error: "Pax count must be at least 1" };

  const gM = gRaw.match(/^G?([0-9O]{1,3})$/);
  if (!gM) return { ok: false, error: `Group "${gRaw}" should be G followed by a number, e.g. G01` };
  const gNum = digits(gM[1]!);

  const todayY = Number(todayISO.slice(0, 4));
  const todayT = Date.UTC(todayY, Number(todayISO.slice(5, 7)) - 1, Number(todayISO.slice(8, 10)));
  let y1 = todayY;
  let startT = Date.UTC(y1, mi1, day1);
  if (startT < todayT - 30 * 86_400_000) {
    y1 += 1;
    startT = Date.UTC(y1, mi1, day1);
  }
  const start = new Date(startT);
  if (day1 < 1 || start.getUTCMonth() !== mi1) return { ok: false, error: `${m1[1]}${m1[2]} is not a valid date` };

  let y2 = y1;
  if (mi2 < mi1 || (mi2 === mi1 && day2 < day1)) y2 += 1;
  const end = new Date(Date.UTC(y2, mi2, day2));
  if (day2 < 1 || end.getUTCMonth() !== mi2) return { ok: false, error: `${m2[1]}${m2[2]} is not a valid date` };

  const partnerGroup = `G${pad(gNum)}`;
  return {
    ok: true,
    value: {
      prefix,
      partner_code: partner,
      travel_date: `${y1}-${pad(mi1 + 1)}-${pad(day1)}`,
      travel_end_date: `${y2}-${pad(mi2 + 1)}-${pad(day2)}`,
      pax,
      partner_group: partnerGroup,
      normalised: `${prefix}-${partner}-${m1[1]}${pad(day1)}-${m2[1]}${pad(day2)}-${pax}PX-${partnerGroup}`,
    },
  };
}

/** Our reference for a B2B group: same shape as the partner's code, with OUR group number. */
export function b2bReference(g: { reference_prefix?: string | null; partner_code: string; travel_date: string; travel_end_date: string; group_code: string }, pax: number): string {
  const tok = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]}${iso.slice(8, 10)}`;
  return `${(g.reference_prefix || "MR144").toUpperCase()}-${g.partner_code.toUpperCase()}-${tok(g.travel_date)}-${tok(g.travel_end_date)}-${pax}PX-${g.group_code}`;
}
