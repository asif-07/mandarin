"use client";

import { parseMrzText, type MrzResult } from "@/lib/apply/mrz";
import type { Worker } from "tesseract.js";

/**
 * OCR in the uploader's browser with tesseract.js (loaded on demand from its
 * CDN; the images never leave the device for this). One worker is kept for
 * the page so a bulk upload of twenty passports loads the engine once.
 */
let workerPromise: Promise<Worker> | null = null;

async function getWorker(onProgress?: (label: string, pct: number) => void): Promise<Worker> {
  if (!workerPromise) {
    onProgress?.("Loading reader", 5);
    workerPromise = import("tesseract.js").then(({ createWorker }) => createWorker("eng", 1)).catch((e) => {
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

async function bitmapFor(file: File): Promise<ImageBitmap | null> {
  if (!file.type.startsWith("image/") || file.type === "image/heic" || file.type === "image/heif") return null;
  return createImageBitmap(file).catch(() => null);
}

/**
 * Reads the passport's machine readable zone: the bottom strip first
 * (upscaled), then the whole page. Null when no readable MRZ is found; the
 * uploader then types the details.
 */
export async function readPassportMrz(file: File, onProgress?: (label: string, pct: number) => void): Promise<MrzResult | null> {
  const bitmap = await bitmapFor(file);
  if (!bitmap) return null;
  const full = draw(bitmap, { scale: Math.min(1, 2000 / bitmap.width) });
  const strip = draw(bitmap, { scale: Math.min(2.2, 2600 / bitmap.width), crop: { top: 0.55, bottom: 1 } });
  bitmap.close?.();
  const worker = await getWorker(onProgress);
  await worker.setParameters({ tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<", preserve_interword_spaces: "0" });
  let i = 0;
  for (const canvas of [strip, full]) {
    onProgress?.("Reading passport", 20 + i++ * 40);
    const { data } = await worker.recognize(canvas);
    const parsed = parseMrzText(data.text ?? "");
    if (parsed && (parsed.valid || (parsed.passport_number.length >= 6 && parsed.surname))) {
      onProgress?.("Done", 100);
      return parsed;
    }
  }
  return null;
}

/** Reads the 10-character PAN (ABCDE1234F) off a PAN card image. Null when none is found. */
export async function readPanNumber(file: File, onProgress?: (label: string, pct: number) => void): Promise<string | null> {
  const bitmap = await bitmapFor(file);
  if (!bitmap) return null;
  const canvas = draw(bitmap, { scale: Math.min(2, 2200 / bitmap.width) });
  bitmap.close?.();
  const worker = await getWorker(onProgress);
  await worker.setParameters({ tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ", preserve_interword_spaces: "1" });
  onProgress?.("Reading PAN card", 40);
  const { data } = await worker.recognize(canvas);
  const text = (data.text ?? "").toUpperCase().replace(/[^A-Z0-9\n ]/g, "");
  // Fourth letter is the holder type (P person, C company, …); the fifth is the surname initial.
  const m = text.match(/\b([A-Z]{3}[ABCFGHLJPTK][A-Z][0-9]{4}[A-Z])\b/) ?? text.replace(/\s+/g, "").match(/([A-Z]{5}[0-9]{4}[A-Z])/);
  onProgress?.("Done", 100);
  return m ? m[1]! : null;
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
