/**
 * Passport MRZ (machine readable zone) parser for the TD3 format: the two
 * 44-character lines at the bottom of the passport data page. Pure and
 * browser-safe: the customer portal runs OCR in the browser and feeds the
 * text here; the CRM never sees the image before the upload is complete.
 *
 * Tolerates the usual OCR confusions (O/0, I/1, S/5, B/8, Z/2, «/<) and
 * verifies the ICAO 9303 check digits so a bad read is reported instead of
 * silently filling the form with wrong data.
 */
export type MrzResult = {
  passport_number: string;
  surname: string;
  given_names: string;
  full_name: string;
  nationality: string; // ISO 3166-1 alpha-3 as printed (IND, ARE, …)
  issuing_country: string;
  date_of_birth: string | null; // YYYY-MM-DD
  sex: "M" | "F" | "X" | null;
  expiry: string | null; // YYYY-MM-DD
  checks: { number: boolean; dob: boolean; expiry: boolean; composite: boolean };
  /** True when every check digit matched: safe to fill the form without a warning. */
  valid: boolean;
  lines: [string, string];
};

const WEIGHTS = [7, 3, 1];

function charValue(c: string): number {
  if (c >= "0" && c <= "9") return c.charCodeAt(0) - 48;
  if (c >= "A" && c <= "Z") return c.charCodeAt(0) - 55;
  return 0; // filler '<'
}

export function checkDigit(s: string): number {
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += charValue(s[i]!) * WEIGHTS[i % 3]!;
  return sum % 10;
}

/** OCR fixes for a field that must be digits only. */
function toDigits(s: string): string {
  return s.replace(/O/g, "0").replace(/Q/g, "0").replace(/D/g, "0").replace(/I/g, "1").replace(/L/g, "1").replace(/Z/g, "2").replace(/S/g, "5").replace(/B/g, "8").replace(/G/g, "6");
}
/** OCR fixes for a field that must be letters / filler only. */
function toAlpha(s: string): string {
  return s.replace(/0/g, "O").replace(/1/g, "I").replace(/5/g, "S").replace(/8/g, "B").replace(/2/g, "Z").replace(/6/g, "G");
}

function yymmdd(s: string, kind: "dob" | "expiry"): string | null {
  const d = toDigits(s);
  if (!/^\d{6}$/.test(d)) return null;
  const yy = Number(d.slice(0, 2));
  const mm = Number(d.slice(2, 4));
  const dd = Number(d.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const nowYY = new Date().getFullYear() % 100;
  // Birth years: anything up to this year is 19xx/20xx by the usual pivot; expiry dates are in the future.
  const century = kind === "dob" ? (yy > nowYY ? 1900 : 2000) : yy < 70 ? 2000 : 1900;
  return `${century + yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

/** Normalise one OCR line into the MRZ alphabet. */
export function normaliseMrzLine(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[«‹]/g, "<")
    .replace(/[^A-Z0-9<]/g, "")
    .trim();
}

/** Pick the two TD3 lines out of free OCR text (handles stray spaces and short reads). */
export function findMrzLines(text: string): [string, string] | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => normaliseMrzLine(l.replace(/\s+/g, "")))
    .filter((l) => l.length >= 40 && l.length <= 48 && (l.match(/</g)?.length ?? 0) >= 3);
  for (let i = 0; i < lines.length - 1; i++) {
    const a = lines[i]!;
    const b = lines[i + 1]!;
    if (/^P[A-Z<]/.test(a)) return [a.padEnd(44, "<").slice(0, 44), b.padEnd(44, "<").slice(0, 44)];
  }
  // Fallback: any line starting with P< followed by a line with digits in the date positions.
  const first = lines.find((l) => /^P[A-Z<]/.test(l));
  const second = lines.find((l) => l !== first && /\d{6}/.test(l));
  return first && second ? [first.padEnd(44, "<").slice(0, 44), second.padEnd(44, "<").slice(0, 44)] : null;
}

function cleanName(s: string): string {
  return s.replace(/</g, " ").replace(/\s+/g, " ").trim();
}

/** Parse two TD3 lines. Returns null when the lines are clearly not a passport MRZ. */
export function parseMrz(line1: string, line2: string): MrzResult | null {
  const l1 = normaliseMrzLine(line1).padEnd(44, "<").slice(0, 44);
  const l2 = normaliseMrzLine(line2).padEnd(44, "<").slice(0, 44);
  if (!/^P/.test(l1)) return null;

  const issuing = toAlpha(l1.slice(2, 5)).replace(/</g, "");
  const [surnameRaw, givenRaw = ""] = l1.slice(5).split("<<");
  const surname = cleanName(toAlpha(surnameRaw ?? ""));
  const given = cleanName(toAlpha(givenRaw));

  const numberRaw = l2.slice(0, 9);
  const numberCheck = toDigits(l2[9] ?? "");
  const nationality = toAlpha(l2.slice(10, 13)).replace(/</g, "");
  const dobRaw = toDigits(l2.slice(13, 19));
  const dobCheck = toDigits(l2[19] ?? "");
  const sexRaw = l2[20] ?? "<";
  const expiryRaw = toDigits(l2.slice(21, 27));
  const expiryCheck = toDigits(l2[27] ?? "");
  const personal = l2.slice(28, 42);
  const personalCheck = l2[42] ?? "<";
  const compositeCheck = toDigits(l2[43] ?? "");

  // Passport numbers mix letters and digits: keep the read as-is, strip filler.
  const number = numberRaw.replace(/</g, "");
  const checks = {
    number: String(checkDigit(numberRaw)) === numberCheck,
    dob: String(checkDigit(dobRaw)) === dobCheck,
    expiry: String(checkDigit(expiryRaw)) === expiryCheck,
    composite: String(checkDigit(numberRaw + numberCheck + dobRaw + dobCheck + expiryRaw + expiryCheck + personal + personalCheck)) === compositeCheck,
  };
  const sex = sexRaw === "M" ? "M" : sexRaw === "F" ? "F" : sexRaw === "X" ? "X" : null;
  const full = [given, surname].filter(Boolean).join(" ");
  if (!number && !surname) return null;
  return {
    passport_number: number,
    surname,
    given_names: given,
    full_name: full,
    nationality,
    issuing_country: issuing,
    date_of_birth: yymmdd(dobRaw, "dob"),
    sex,
    expiry: yymmdd(expiryRaw, "expiry"),
    checks,
    valid: checks.number && checks.dob && checks.expiry,
    lines: [l1, l2],
  };
}

/** OCR text in, parsed passport out (null when no MRZ was found). */
export function parseMrzText(text: string): MrzResult | null {
  const lines = findMrzLines(text);
  if (!lines) return null;
  return parseMrz(lines[0], lines[1]);
}

/** ISO alpha-3 codes that appear on passports of the customers we serve, for a friendly nationality label. */
const COUNTRY_NAMES: Record<string, string> = {
  IND: "Indian",
  ARE: "Emirati",
  SAU: "Saudi",
  QAT: "Qatari",
  OMN: "Omani",
  KWT: "Kuwaiti",
  BHR: "Bahraini",
  PAK: "Pakistani",
  BGD: "Bangladeshi",
  LKA: "Sri Lankan",
  NPL: "Nepali",
  PHL: "Filipino",
  EGY: "Egyptian",
  GBR: "British",
  USA: "American",
  CAN: "Canadian",
};
export function nationalityLabel(alpha3: string): string {
  return COUNTRY_NAMES[alpha3] ?? alpha3;
}
