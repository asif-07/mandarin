"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, QrCode, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrScanner } from "@/components/scanner/qr-scanner";
import type { ScannerPartner } from "@/lib/scanner/auth";

/** Pull the token out of whatever the camera decoded: our scan URL, or a bare token. */
export function tokenFromScan(text: string): string | null {
  const t = text.trim();
  const m = t.match(/\/scan\/v\/([A-Za-z0-9_-]{16,128})/);
  if (m) return m[1]!;
  if (/^[A-Za-z0-9_-]{32,128}$/.test(t)) return t;
  return null;
}

export function ScannerHome({ partner }: { partner: ScannerPartner }) {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");
  const [error, setError] = useState<string | null>(null);

  function open(text: string) {
    const token = tokenFromScan(text);
    if (!token) return void setError("That code is not a transfer voucher QR");
    setScanning(false);
    router.push(`/scan/v/${token}`);
  }

  async function signOut() {
    await fetch("/api/scan/logout", { method: "POST" }).catch(() => undefined);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-mr-line bg-white px-4 py-3">
        <div>
          <p className="text-xs text-mr-muted">Signed in as</p>
          <p className="text-sm font-medium">
            {partner.code} · {partner.name}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={signOut}>
          <LogOut /> Sign out
        </Button>
      </div>

      {scanning ? (
        <QrScanner onResult={open} onCancel={() => setScanning(false)} />
      ) : (
        <Button type="button" className="h-14 w-full text-base" onClick={() => (setError(null), setScanning(true))}>
          <ScanLine className="size-5" /> Scan voucher
        </Button>
      )}

      <div className="rounded-lg border border-mr-line bg-white p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <QrCode className="size-4" /> Camera not working?
        </p>
        <p className="mt-1 text-xs text-mr-muted">Paste the link under the QR code, or the voucher token, and open it.</p>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            open(manual);
          }}
        >
          <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="https://…/scan/v/…" className="h-11" />
          <Button type="submit" variant="outline" className="h-11" disabled={!manual.trim()}>
            Open
          </Button>
        </form>
      </div>
      {error && <p className="text-sm text-mr-red">{error}</p>}
    </div>
  );
}
