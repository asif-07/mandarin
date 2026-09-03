import { readFile } from "node:fs/promises";
import path from "node:path";
import type { TemplateAssets } from "@/lib/pdf/invoice-template";

const cache = new Map<string, string>();

async function publicFileAsDataUri(file: string, mime: string): Promise<string> {
  const cached = cache.get(file);
  if (cached) return cached;
  const buf = await readFile(path.join(process.cwd(), "public", file));
  const uri = `data:${mime};base64,${buf.toString("base64")}`;
  cache.set(file, uri);
  return uri;
}

/** Logo + signature embedded as data URIs so Puppeteer needs no network for them. */
export async function loadTemplateAssets(): Promise<TemplateAssets> {
  const [logoSrc, signatureSrc] = await Promise.all([
    publicFileAsDataUri("logo.png", "image/png"),
    publicFileAsDataUri("signature.png", "image/png"),
  ]);
  return { logoSrc, signatureSrc };
}

export async function loadPublicFile(file: string): Promise<Buffer> {
  return readFile(path.join(process.cwd(), "public", file));
}
