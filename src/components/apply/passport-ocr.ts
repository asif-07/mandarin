"use client";

import { parseMrzText, type MrzResult } from "@/lib/apply/mrz";
import type { Worker } from "tesseract.js";

/**
 * OCR in the uploader's browser with tesseract.js (engine and English data
 * are fetched from its CDN on first use and cached by the browser; the
 * images never leave the device for this). One worker is kept per page.
 */
export type OcrProgress = (label: string, pct: number) => void;

let workerPromise: Promise<Worker> | null = null;
let progressSink: OcrProgress | null = null;

function describe(m: { status?: string; progress?: number }): string | null {
  const pct = typeof m.progress === "number" ? Math.round(m.progress * 100) : null;
  switch (m.status) {
    case "loading tesseract core":
      return `Loading reader${pct !== null ? ` ${pct}%` : ""}`;
    case "initializing tesseract":
    case "initializing api":
      return "Starting reader";
    case "loading language traineddata":
      return `Downloading language data${pct !== null ? ` ${pct}%` : ""}`;
    case "recognizing text":
      return `Reading${pct !== null ? ` ${pct}%` : ""}`;
    default:
      return null;
  }
}

async function getWorker(onProgress?: OcrProgress): Promise<Worker> {
  progressSink = onProgress ?? null;
  if (!workerPromise) {
    onProgress?.("Loading reader", 3);
    // Test hook: a page can point the engine at self-hosted files instead of the CDN.
    const overrides = (globalThis as unknown as { __tesseractOptions?: Record<string, unknown> }).__tesseractOptions ?? {};
    workerPromise = import("tesseract.js")
      .then(({ createWorker }) =>
        createWorker("eng", 1, {
          ...overrides,
          logger: (m: { status?: string; progress?: number }) => {
            const label = describe(m);
            if (!label) return;
            const base = m.status === "loading language traineddata" ? 10 : m.status === "recognizing text" ? 55 : 5;
            progressSink?.(label, base + Math.round((m.progress ?? 0) * (m.status === "recognizing text" ? 40 : 35)));
          },
        }),
      )
      .catch((e) => {
        workerPromise = null;
        throw new Error(`the reader could not be loaded (${e instanceof Error ? e.message : String(e)})`);
      });
  }
  return workerPromise;
}

/** Decode an image file into a bitmap; HEIC and PDF cannot be decoded in the browser. */
async function bitmapFor(src: Blob): Promise<ImageBitmap | null> {
  if (src.type === "application/pdf" || src.type === "image/heic" || src.type === "image/heif") return null;
  try {
    return await createImageBitmap(src);
  } catch {
    // Older Safari: go through an <img> element instead.
    const url = URL.createObjectURL(src);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return await createImageBitmap(img);
    } catch {
      return null;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/** True when this file can be read in the browser (JPEG / PNG / WebP). */
export function canReadLocally(file: File): boolean {
  return file.type.startsWith("image/") && file.type !== "image/heic" && file.type !== "image/heif";
}

/** The stored copy of a document (the server converts HEIC to JPEG), for reading when the local file cannot be decoded. */
export async function fetchStoredImage(url: string): Promise<Blob> {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`could not fetch the uploaded image (${res.status})`);
  return res.blob();
}

/**
 * Reads the passport's machine readable zone: the bottom strip first
 * (upscaled), then the whole page. Null when no readable MRZ is found; the
 * uploader then types the details. Throws when the engine cannot load.
 */
export async function readPassportMrz(src: Blob, onProgress?: OcrProgress): Promise<MrzResult | null> {
  onProgress?.("Preparing image", 2);
  const bitmap = await bitmapFor(src);
  if (!bitmap) throw new Error("this image format cannot be read here");
  const full = draw(bitmap, { scale: Math.min(1, 2000 / bitmap.width) });
  const strip = draw(bitmap, { scale: Math.min(2.2, 2600 / bitmap.width), crop: { top: 0.55, bottom: 1 } });
  bitmap.close?.();
  const worker = await getWorker(onProgress);
  await worker.setParameters({ tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<", preserve_interword_spaces: "0" });
  for (const canvas of [strip, full]) {
    onProgress?.("Reading passport", 55);
    const { data } = await worker.recognize(canvas);
    const parsed = parseMrzText(data.text ?? "");
    if (parsed && (parsed.valid || (parsed.passport_number.length >= 6 && parsed.surname))) {
      onProgress?.("Done", 100);
      return parsed;
    }
  }
  onProgress?.("Done", 100);
  return null;
}

/** Reads the 10-character PAN (ABCDE1234F) off a PAN card image. Null when none is found. */
export async function readPanNumber(src: Blob, onProgress?: OcrProgress): Promise<string | null> {
  const bitmap = await bitmapFor(src);
  if (!bitmap) return null;
  const canvas = draw(bitmap, { scale: Math.min(2, 2200 / bitmap.width) });
  bitmap.close?.();
  const worker = await getWorker(onProgress);
  await worker.setParameters({ tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ", preserve_interword_spaces: "1" });
  onProgress?.("Reading PAN card", 55);
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
