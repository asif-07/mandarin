"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileUp, Loader2, ScanLine, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScannerPartner } from "@/lib/scanner/auth";
import type { ScannerVoucher } from "@/lib/scanner/types";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** The live record for one voucher, with ticket upload and one-time redemption. */
export function VoucherVerify({ token, initial, partner }: { token: string; initial: ScannerVoucher; partner: ScannerPartner }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState<"upload" | "redeem" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy("upload");
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch(`/api/scan/voucher/${token}/ticket`, { method: "POST", body: fd });
      const body = (await res.json().catch(() => ({}))) as { error?: string; voucher?: ScannerVoucher };
      if (body.voucher) setV(body.voucher);
      if (!res.ok) setError(body.error ?? "Upload failed");
    } catch {
      setError("No connection. The ticket was not uploaded.");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function redeem() {
    if (!confirm(`Redeem ${v.voucher_no} for ${v.pax} pax to ${v.to_place}? This can be done once.`)) return;
    setBusy("redeem");
    setError(null);
    try {
      const res = await fetch(`/api/scan/voucher/${token}/redeem`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string; voucher?: ScannerVoucher };
      if (body.voucher) setV(body.voucher);
      if (!res.ok) setError(body.error ?? "Could not redeem");
      router.refresh();
    } catch {
      setError("No connection. The voucher was not redeemed.");
    } finally {
      setBusy(null);
    }
  }

  const redeemed = v.status === "redeemed";
  const cancelled = v.status === "cancelled";
  const rows: [string, string][] = [
    ["Voucher No.", v.voucher_no],
    ["Group ID", v.group_ref],
    ["Transfer date", formatDate(v.transfer_date)],
    ["Passengers", `${v.pax} pax`],
    ["From", v.from_place],
    ["To", v.to_place],
    ["Transfer type", v.transfer_mode_label ?? "—"],
  ];

  return (
    <div className="space-y-4">
      <div className={cn("rounded-lg border p-4 text-center", redeemed ? "border-mr-red bg-mr-red/5" : cancelled ? "border-mr-line bg-white" : "border-mr-success bg-mr-success/5")}>
        {redeemed ? (
          <>
            <XCircle className="mx-auto size-10 text-mr-red" />
            <p className="mt-2 font-heading text-xl font-bold tracking-wide text-mr-red">VOUCHER ALREADY REDEEMED</p>
            <p className="mt-1 text-sm text-mr-body">
              {v.redeemed ? `${formatDateTime(v.redeemed.at)} · by ${v.redeemed.by}` : ""}
            </p>
          </>
        ) : cancelled ? (
          <>
            <AlertTriangle className="mx-auto size-10 text-mr-warning" />
            <p className="mt-2 font-heading text-xl font-bold tracking-wide">VOUCHER CANCELLED</p>
            <p className="mt-1 text-sm text-mr-body">Do not provide the transfer. {v.cancelled_at ? `Cancelled ${formatDateTime(v.cancelled_at)}.` : ""}</p>
          </>
        ) : (
          <>
            <CheckCircle2 className="mx-auto size-10 text-mr-success" />
            <p className="mt-2 font-heading text-xl font-bold tracking-wide text-mr-success">ACTIVE</p>
            <p className="mt-1 text-sm text-mr-body">Live CRM record. Compare it with the PDF the customer shows you.</p>
          </>
        )}
      </div>

      <dl className="divide-y divide-mr-line rounded-lg border border-mr-line bg-white">
        {rows.map(([k, val]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
            <dt className="text-xs text-mr-muted">{k}</dt>
            <dd className="text-right text-sm font-semibold">{val}</dd>
          </div>
        ))}
        {v.notes && (
          <div className="px-4 py-2.5">
            <dt className="text-xs text-mr-muted">Notes</dt>
            <dd className="mt-0.5 text-sm">{v.notes}</dd>
          </div>
        )}
      </dl>

      {!cancelled && (
        <div className="rounded-lg border border-mr-line bg-white p-4">
          <p className="text-sm font-medium">1 · Transport ticket</p>
          {v.ticket ? (
            <p className="mt-1 text-sm text-mr-success">
              Uploaded {formatDateTime(v.ticket.uploaded_at)}
              {v.ticket.by ? ` by ${v.ticket.by}` : ""} · {v.ticket.file_name}
            </p>
          ) : (
            <p className="mt-1 text-xs text-mr-muted">Attach the ticket you issued to the guest (PDF, JPG or PNG). It is filed under the voucher and the group.</p>
          )}
          {!redeemed && (
            <>
              <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
              <Button type="button" variant={v.ticket ? "outline" : "default"} className="mt-3 h-11 w-full" disabled={busy !== null} onClick={() => fileRef.current?.click()}>
                {busy === "upload" ? <Loader2 className="animate-spin" /> : <FileUp />} {v.ticket ? "Replace ticket" : "Upload ticket"}
              </Button>
            </>
          )}
        </div>
      )}

      {!cancelled && !redeemed && (
        <div className="rounded-lg border border-mr-line bg-white p-4">
          <p className="text-sm font-medium">2 · Redeem voucher</p>
          <p className="mt-1 text-xs text-mr-muted">{v.ticket ? "Marks the voucher as used. It cannot be redeemed again." : "Upload the ticket first."}</p>
          <Button type="button" className="mt-3 h-12 w-full text-base" disabled={!v.ticket || busy !== null} onClick={redeem}>
            {busy === "redeem" ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Redeem voucher
          </Button>
        </div>
      )}

      {error && <p className="rounded-md bg-mr-red/5 p-3 text-sm text-mr-red">{error}</p>}

      <div className="flex items-center justify-between text-xs text-mr-muted">
        <span>
          {partner.code} · {partner.name}
        </span>
        <Link href="/scan" className="inline-flex items-center gap-1 font-medium text-mr-ink underline">
          <ScanLine className="size-3.5" /> Scan another
        </Link>
      </div>
    </div>
  );
}
