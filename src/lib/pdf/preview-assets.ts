import type { TemplateAssets } from "@/lib/pdf/invoice-template";
import { buildFontCss } from "@/lib/pdf/fonts";

/** Assets for the in-app preview iframe: same files as the PDF, loaded by URL. Safe for client bundles. */
export function previewTemplateAssets(): TemplateAssets {
  return {
    logoSrc: "/logo.png",
    signatureSrc: "/signature.png",
    fontCss: buildFontCss((file) => `/fonts/${file}`),
  };
}
