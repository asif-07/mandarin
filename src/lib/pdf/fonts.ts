/**
 * Fonts embedded in the invoice / travel-pack HTML. The reference invoice was
 * typeset in Carlito (metric-compatible with Calibri) with Noto Sans CJK for
 * the Chinese address, so those are the faces used here. Files live in
 * /public/fonts; the server inlines them as data URIs so Puppeteer never
 * depends on the network, and the browser preview loads them by URL.
 */
export const FONT_FILES = [
  { family: "Carlito", weight: 400, style: "normal", file: "carlito-regular.woff2" },
  { family: "Carlito", weight: 700, style: "normal", file: "carlito-bold.woff2" },
  { family: "Carlito", weight: 400, style: "italic", file: "carlito-italic.woff2" },
  { family: "MR Noto Sans SC", weight: 400, style: "normal", file: "noto-sans-sc-subset.woff2" },
] as const;

/** Google Fonts fallback for CJK characters outside the embedded subset. */
export const CJK_FALLBACK_HREF =
  "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=block";

export function buildFontCss(resolveSrc: (file: string) => string): string {
  return FONT_FILES.map(
    (f) => `@font-face {
  font-family: "${f.family}";
  font-weight: ${f.weight};
  font-style: ${f.style};
  font-display: block;
  src: url("${resolveSrc(f.file)}") format("woff2");
}`,
  ).join("\n");
}

/** Font stack for body text: Latin from Carlito, CJK from the subset, then Google's Noto Sans SC. */
export const FONT_STACK = `"Carlito", "MR Noto Sans SC", "Noto Sans SC", "Noto Sans CJK SC", Calibri, "Helvetica Neue", Arial, sans-serif`;
