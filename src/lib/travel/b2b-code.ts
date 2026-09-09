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

const CODE_RE = /^([A-Z0-9]{2,12})[-_ ]+([A-Z0-9]{2,12})[-_ ]+([A-Z]{3})(\d{1,2})[-_ ]+([A-Z]{3})(\d{1,2})[-_ ]+(\d{1,5})PX[-_ ]+G(\d{1,3})$/;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Strip a file extension and surrounding noise before parsing ("… G01.pdf", "…G01 (1)"). */
export function cleanB2bCode(raw: string): string {
  return raw
    .trim()
    .replace(/\.(pdf|PDF)$/i, "")
    .replace(/\s*\(\d+\)$/, "")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

/**
 * Parse the code. `todayISO` decides the year: the entry date is placed in the
 * current year unless that would be more than 30 days in the past, in which
 * case next year is used. An exit month before the entry month rolls into the
 * following year (DEC28-JAN02).
 */
export function parseB2bCode(raw: string, todayISO: string): { ok: true; value: ParsedB2bCode } | { ok: false; error: string } {
  const code = cleanB2bCode(raw);
  const m = code.match(CODE_RE);
  if (!m) return { ok: false, error: "Expected a code like MR144-EDPT-OCT15-OCT20-100PX-G01" };
  const [, prefix, partner, m1, d1, m2, d2, paxStr, gNum] = m;
  const mi1 = MONTHS.indexOf(m1!);
  const mi2 = MONTHS.indexOf(m2!);
  if (mi1 === -1) return { ok: false, error: `Unknown month "${m1}"` };
  if (mi2 === -1) return { ok: false, error: `Unknown month "${m2}"` };

  const todayY = Number(todayISO.slice(0, 4));
  const todayT = Date.UTC(todayY, Number(todayISO.slice(5, 7)) - 1, Number(todayISO.slice(8, 10)));
  let y1 = todayY;
  let startT = Date.UTC(y1, mi1, Number(d1));
  if (startT < todayT - 30 * 86_400_000) {
    y1 += 1;
    startT = Date.UTC(y1, mi1, Number(d1));
  }
  const start = new Date(startT);
  if (start.getUTCMonth() !== mi1) return { ok: false, error: `${m1}${d1} is not a valid date` };

  let y2 = y1;
  if (mi2 < mi1 || (mi2 === mi1 && Number(d2) < Number(d1))) y2 += 1;
  const end = new Date(Date.UTC(y2, mi2, Number(d2)));
  if (end.getUTCMonth() !== mi2) return { ok: false, error: `${m2}${d2} is not a valid date` };

  const pax = Number(paxStr);
  if (!pax) return { ok: false, error: "Pax count must be at least 1" };

  const partnerGroup = `G${pad(Number(gNum))}`;
  return {
    ok: true,
    value: {
      prefix: prefix!,
      partner_code: partner!,
      travel_date: `${y1}-${pad(mi1 + 1)}-${pad(Number(d1))}`,
      travel_end_date: `${y2}-${pad(mi2 + 1)}-${pad(Number(d2))}`,
      pax,
      partner_group: partnerGroup,
      normalised: `${prefix}-${partner}-${m1}${pad(Number(d1))}-${m2}${pad(Number(d2))}-${pax}PX-${partnerGroup}`,
    },
  };
}

/** Our reference for a B2B group: same shape as the partner's code, with OUR group number. */
export function b2bReference(g: { reference_prefix?: string | null; partner_code: string; travel_date: string; travel_end_date: string; group_code: string }, pax: number): string {
  const tok = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]}${iso.slice(8, 10)}`;
  return `${(g.reference_prefix || "MR144").toUpperCase()}-${g.partner_code.toUpperCase()}-${tok(g.travel_date)}-${tok(g.travel_end_date)}-${pax}PX-${g.group_code}`;
}
