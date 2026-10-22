"use client";

import { parseMrzText, type MrzResult } from "@/lib/apply/mrz";

/**
 * Reads the passport's machine readable zone in the customer's browser with
 * tesseract.js (loaded on demand from its CDN; nothing runs on our server
 * and the image never leaves the device for OCR). Tries the whole page
 * first, then the bottom strip where the MRZ sits, upscaled. Returns null
 * when no readable MRZ is found; the customer then types the details.
 */
export async function readPassportMrz(file: File, onProgress?: (label: string, pct: number) => void): Promise<MrzResult | null> {
  if (!file.type.startsWith("image/") || file.type === "image/heic" || file.type === "image/heif") return null;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return null;

  const full = draw(bitmap, { scale: Math.min(1, 2000 / bitmap.width) });
  const strip = draw(bitmap, { scale: Math.min(2.2, 2600 / bitmap.width), crop: { top: 0.55, bottom: 1 } });
  bitmap.close?.();

  const { createWorker } = await import("tesseract.js");
  onProgress?.("Loading reader", 5);
  const worker = await createWorker("eng", 1, {
    logger: (m: { status?: string; progress?: number }) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") onProgress?.("Reading passport", 20 + Math.round(m.progress * 70));
    },
  });
  try {
    await worker.setParameters({ tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<", preserve_interword_spaces: "0" });
    for (const canvas of [strip, full]) {
      const { data } = await worker.recognize(canvas);
      const parsed = parseMrzText(data.text ?? "");
      if (parsed && (parsed.valid || (parsed.passport_number.length >= 6 && parsed.surname))) {
        onProgress?.("Done", 100);
        return parsed;
      }
    }
    return null;
  } finally {
    await worker.terminate().catch(() => undefined);
  }
}

function draw(bitmap: ImageBitmap, opts: { scale: number; crop?: { top: number; bottom: number } }): HTMLCanvasElement {
  const top = Math.floor(bitmap.height * (opts.crop?.top ?? 0));
  const bottom = Math.floor(bitmap.height * (opts.crop?.bottom ?? 1));
  const srcH = Math.max(1, bottom - top);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * opts.scale));
  canvas.height = Math.max(1, Math.round(srcH * opts.scale));
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, top, bitmap.width, srcH, 0, 0, canvas.width, canvas.height);
  // Greyscale with a little contrast: MRZ is black on white, OCR likes it crisp.
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
    const v = Math.max(0, Math.min(255, (g - 128) * 1.25 + 128));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
