import type { NextRequest } from "next/server";

/**
 * Base URL printed inside voucher QR codes. SCANNER_BASE_URL (for example
 * https://chinatravelsupport.com) wins when set; otherwise the host that
 * served the request, so the QR opens the same deployment that issued it.
 */
export function scannerBaseUrl(request: NextRequest): string {
  const configured = process.env.SCANNER_BASE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
