import type { Currency } from "@/lib/constants";

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundred(n: number): string {
  if (n < 20) return ONES[n]!;
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o ? `${TENS[t]}-${ONES[o]}` : TENS[t]!;
}

/** 0..999 in British style: "Two Hundred and Twenty" */
function belowThousand(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h && r) return `${ONES[h]} Hundred and ${belowHundred(r)}`;
  if (h) return `${ONES[h]} Hundred`;
  return belowHundred(r);
}

/** International grouping (thousand, million, billion). */
function wordsInternational(n: number): string {
  if (n === 0) return "Zero";
  const scales = ["", "Thousand", "Million", "Billion", "Trillion"];
  const parts: string[] = [];
  let i = 0;
  let rest = n;
  while (rest > 0) {
    const chunk = rest % 1000;
    if (chunk) {
      const w = belowThousand(chunk);
      parts.unshift(scales[i] ? `${w} ${scales[i]}` : w);
    }
    rest = Math.floor(rest / 1000);
    i++;
  }
  // "One Thousand and Twenty" when the last chunk is < 100 and there is a bigger part
  const last = n % 1000;
  if (parts.length > 1 && last > 0 && last < 100) {
    const tail = parts.pop()!;
    return `${parts.join(" ")} and ${tail}`;
  }
  return parts.join(" ");
}

/** Indian grouping (thousand, lakh, crore). */
function wordsIndian(n: number): string {
  if (n === 0) return "Zero";
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${wordsIndian(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (rest) {
    if (parts.length && rest < 100) parts.push(`and ${belowHundred(rest)}`);
    else parts.push(belowThousand(rest));
  }
  return parts.join(" ");
}

const CURRENCY_WORDS: Record<Currency, { major: string; minor: string; indian?: boolean }> = {
  USD: { major: "US Dollars", minor: "Cents" },
  AED: { major: "UAE Dirhams", minor: "Fils" },
  CNY: { major: "Chinese Yuan", minor: "Fen" },
  INR: { major: "Indian Rupees", minor: "Paise", indian: true },
};

/**
 * 220.00 USD  -> "US Dollars Two Hundred and Twenty Only"
 * 220.50 USD  -> "US Dollars Two Hundred and Twenty and Fifty Cents Only"
 */
export function amountInWords(amount: number, currency: Currency): string {
  const cfg = CURRENCY_WORDS[currency] ?? CURRENCY_WORDS.USD;
  const safe = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const cents = Math.round(safe * 100);
  const major = Math.floor(cents / 100);
  const minor = cents % 100;
  const toWords = cfg.indian ? wordsIndian : wordsInternational;

  let words = `${cfg.major} ${toWords(major)}`;
  if (minor > 0) {
    words += ` and ${belowHundred(minor)} ${cfg.minor}`;
  }
  return `${words} Only`;
}
