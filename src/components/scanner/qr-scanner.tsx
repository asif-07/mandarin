"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Detector = { detect: (source: ImageBitmapSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

/**
 * Phone-camera QR reader with no app install: the browser's BarcodeDetector
 * when available (Chrome on Android), otherwise jsQR over video frames
 * (Safari on iPhone). Calls onResult once with the decoded text.
 */
export function QrScanner({ onResult, onCancel }: { onResult: (text: string) => void; onCancel: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const video = videoRef.current!;
    const canvas = canvasRef.current!;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) return void setError("This browser cannot open the camera. Use the link field below instead.");
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      } catch {
        return void setError("Camera permission was refused. Allow the camera for this site, or use the link field below.");
      }
      if (stopped) return void stream.getTracks().forEach((t) => t.stop());
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      setReady(true);

      const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
      const detector = Ctor ? new Ctor({ formats: ["qr_code"] }) : null;
      const jsqr = detector ? null : (await import("jsqr")).default;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      const tick = async () => {
        if (stopped || done.current) return;
        if (video.readyState >= 2) {
          try {
            if (detector) {
              const codes = await detector.detect(video);
              const hit = codes.find((c) => c.rawValue);
              if (hit) return finish(hit.rawValue);
            } else if (jsqr && ctx) {
              const w = (canvas.width = Math.min(video.videoWidth, 640));
              const h = (canvas.height = Math.round((video.videoHeight / video.videoWidth) * w) || 480);
              ctx.drawImage(video, 0, 0, w, h);
              const img = ctx.getImageData(0, 0, w, h);
              const code = jsqr(img.data, w, h, { inversionAttempts: "dontInvert" });
              if (code?.data) return finish(code.data);
            }
          } catch {
            // keep scanning
          }
        }
        raf = requestAnimationFrame(() => void tick());
      };
      raf = requestAnimationFrame(() => void tick());
    }

    function finish(text: string) {
      if (done.current) return;
      done.current = true;
      if (navigator.vibrate) navigator.vibrate(60);
      onResult(text);
    }

    void start();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  return (
    <div className="overflow-hidden rounded-lg border border-mr-line bg-black">
      <div className="relative aspect-[3/4] w-full">
        <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline muted />
        <canvas ref={canvasRef} className="hidden" />
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <Loader2 className="size-6 animate-spin" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="size-56 rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        </div>
        {error && <p className="absolute inset-x-3 bottom-3 rounded-md bg-white/95 p-3 text-center text-sm text-mr-red">{error}</p>}
      </div>
      <div className="flex items-center justify-between bg-white px-3 py-2">
        <p className="text-xs text-mr-muted">Point the camera at the QR on the customer&rsquo;s voucher.</p>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <X /> Close
        </Button>
      </div>
    </div>
  );
}
