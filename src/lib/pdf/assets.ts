import { readFile } from "node:fs/promises";
import path from "node:path";
import type { TemplateAssets } from "@/lib/pdf/invoice-template";
import { buildFontCss } from "@/lib/pdf/fonts";

const cache = new Map<string, string>();

async function publicFileAsDataUri(file: string, mime: string): Promise<string> {
  const cached = cache.get(file);
  if (cached) return cached;
  const buf = await readFile(path.join(process.cwd(), "public", file));
  const uri = `data:${mime};base64,${buf.toString("base64")}`;
  cache.set(file, uri);
  return uri;
}

/**
 * Logo, signature and fonts embedded as data URIs so Puppeteer needs no
 * network access to render the invoice.
 */
export async function loadTemplateAssets(): Promise<TemplateAssets> {
  const [logoSrc, signatureSrc] = await Promise.all([
    publicFileAsDataUri("logo.png", "image/png"),
    publicFileAsDataUri("signature.png", "image/png"),
  ]);
  const fontUris = new Map<string, string>();
  for (const f of ["carlito-regular.woff2", "carlito-bold.woff2", "carlito-italic.woff2", "noto-sans-sc-subset.woff2"]) {
    fontUris.set(f, await publicFileAsDataUri(`fonts/${f}`, "font/woff2"));
  }
  return { logoSrc, signatureSrc, fontCss: buildFontCss((file) => fontUris.get(file) ?? `/fonts/${file}`) };
}

/** Assets for the in-app preview iframe: same files, loaded by URL. */
export function previewTemplateAssets(): TemplateAssets {
  return {
    logoSrc: "/logo.png",
    signatureSrc: "/signature.png",
    fontCss: buildFontCss((file) => `/fonts/${file}`),
  };
}

export async function loadPublicFile(file: string): Promise<Buffer> {
  return readFile(path.join(process.cwd(), "public", file));
}
