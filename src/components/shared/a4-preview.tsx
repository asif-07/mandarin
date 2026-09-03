"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const A4_WIDTH = 794; // px at 96dpi
const A4_HEIGHT = 1123;

/**
 * Renders an HTML document in a sandboxed iframe at true A4 pixel size and
 * scales it down to fit the container width, so the preview is identical to
 * the PDF on any screen.
 */
export function A4Preview({ html, className }: { html: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / A4_WIDTH));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn("w-full", className)}>
      <div
        className="relative overflow-hidden border border-mr-line bg-white"
        style={{ width: A4_WIDTH * scale, height: A4_HEIGHT * scale }}
      >
        <iframe
          title="Invoice preview"
          srcDoc={html}
          sandbox="allow-same-origin"
          className="absolute left-0 top-0 origin-top-left border-0 bg-white"
          style={{ width: A4_WIDTH, height: A4_HEIGHT, transform: `scale(${scale})` }}
        />
      </div>
    </div>
  );
}
