"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileUp, Loader2, Upload, X, XCircle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cleanB2bCode, parseB2bCode } from "@/lib/travel/b2b-code";
import { formatDate, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

type Row = { file: File; code: string; status: "ready" | "uploading" | "done" | "failed"; result?: { id: string; group_ref: string; pax: number; travel_date: string; travel_end_date: string }; error?: string };

/**
 * Drop one or more PDFs named with the partner code
 * (MR144-EDPT-OCT15-OCT20-100PX-G01.pdf). Each code is recognised live
 * (dates, pax), then every file becomes its own draft group with the PDF
 * filed as its pack. The partner adds flight details and submits each group.
 */
export function PartnerBulkUpload({ partnerCode }: { partnerCode: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const today = todayISO();

  function add(files: FileList | File[]) {
    const next: Row[] = [];
    for (const f of Array.from(files)) {
      if (f.type !== "application/pdf" && !/\.pdf$/i.test(f.name)) continue;
      next.push({ file: f, code: cleanB2bCode(f.name), status: "ready" });
    }
    setRows((r) => [...r, ...next]);
  }

  async function uploadAll() {
    setBusy(true);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      if (row.status === "done") continue;
      const parsed = parseB2bCode(row.code, today);
      if (!parsed.ok) {
        setRows((r) => r.map((x, j) => (j === i ? { ...x, status: "failed", error: parsed.error } : x)));
        continue;
      }
      setRows((r) => r.map((x, j) => (j === i ? { ...x, status: "uploading", error: undefined } : x)));
      try {
        const fd = new FormData();
        fd.set("file", row.file);
        fd.set("code", row.code);
        const res = await fetch("/api/partner/groups/upload", { method: "POST", body: fd });
        const body = (await res.json().catch(() => ({}))) as { error?: string; id?: string; group_ref?: string; pax?: number; travel_date?: string; travel_end_date?: string };
        if (!res.ok || !body.id) setRows((r) => r.map((x, j) => (j === i ? { ...x, status: "failed", error: body.error ?? "Upload failed" } : x)));
        else setRows((r) => r.map((x, j) => (j === i ? { ...x, status: "done", result: { id: body.id!, group_ref: body.group_ref ?? "", pax: body.pax ?? 0, travel_date: body.travel_date ?? "", travel_end_date: body.travel_end_date ?? "" } } : x)));
      } catch {
        setRows((r) => r.map((x, j) => (j === i ? { ...x, status: "failed", error: "No connection" } : x)));
      }
    }
    setBusy(false);
    router.refresh();
  }

  const pending = rows.filter((r) => r.status !== "done");
  const done = rows.filter((r) => r.status === "done");

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => (e.preventDefault(), setDragging(true))}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => (e.preventDefault(), setDragging(false), add(e.dataTransfer.files))}
        onClick={() => inputRef.current?.click()}
        className={cn("cursor-pointer rounded-lg border-2 border-dashed bg-white p-8 text-center transition-colors", dragging ? "border-mr-ink bg-mr-surface" : "border-mr-line hover:border-mr-ink/50")}
      >
        <input ref={inputRef} type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => e.target.files && add(e.target.files)} />
        <Upload className="mx-auto size-6 text-mr-muted" />
        <p className="mt-2 text-sm text-mr-body">Drop your group PDFs here, or click to choose. Several at once is fine.</p>
        <p className="mt-1 text-xs text-mr-muted">
          Name each file with the code, e.g. <span className="font-mono">MR144-{partnerCode}-OCT15-OCT20-100PX-G01.pdf</span>. Entry and exit dates, pax and your group number are read from it.
        </p>
      </div>

      {rows.length > 0 && (
        <ul className="divide-y divide-mr-line rounded-lg border border-mr-line bg-white">
          {rows.map((row, i) => {
            const parsed = parseB2bCode(row.code, today);
            return (
              <li key={`${row.file.name}-${i}`} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-mr-ink">{row.file.name}</span>
                  {row.status === "done" ? <CheckCircle2 className="size-4 text-mr-success" /> : row.status === "failed" ? <XCircle className="size-4 text-mr-red" /> : row.status === "uploading" ? <Loader2 className="size-4 animate-spin text-mr-muted" /> : null}
                  {row.status !== "done" && !busy && (
                    <Button type="button" variant="ghost" size="icon-xs" aria-label="Remove" onClick={() => setRows((r) => r.filter((_, j) => j !== i))}>
                      <X />
                    </Button>
                  )}
                </div>
                {row.status === "done" && row.result ? (
                  <p className="mt-1 text-xs text-mr-success">
                    Created{" "}
                    <Link href={`/partner/groups/${row.result.id}`} className="font-mono underline">
                      {row.result.group_ref}
                    </Link>{" "}
                    · {formatDate(row.result.travel_date)} to {formatDate(row.result.travel_end_date)} · {row.result.pax} pax. Add the flight details and submit.
                  </p>
                ) : (
                  <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                    <Input value={row.code} disabled={busy} onChange={(e) => setRows((r) => r.map((x, j) => (j === i ? { ...x, code: e.target.value.toUpperCase() } : x)))} placeholder={`MR144-${partnerCode}-OCT15-OCT20-100PX-G01`} className="font-mono text-sm" />
                    <p className={cn("self-center text-xs", parsed.ok ? "text-mr-body" : "text-mr-red")}>{parsed.ok ? `${formatDate(parsed.value.travel_date)} to ${formatDate(parsed.value.travel_end_date)} · ${parsed.value.pax} pax` : parsed.error}</p>
                  </div>
                )}
                {row.error && <p className="mt-1 text-xs text-mr-red">{row.error}</p>}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-mr-muted">{done.length ? `${done.length} group${done.length === 1 ? "" : "s"} created.` : ""}</p>
        <div className="flex items-center gap-2">
          {done.length > 0 && (
            <Link href="/partner" className={buttonVariants({ variant: "outline" })}>
              Back to groups
            </Link>
          )}
          <Button type="button" disabled={busy || pending.length === 0} onClick={uploadAll}>
            {busy ? <Loader2 className="animate-spin" /> : <FileUp />} Create {pending.length || ""} group{pending.length === 1 ? "" : "s"} from PDF{pending.length === 1 ? "" : "s"}
          </Button>
        </div>
      </div>
    </div>
  );
}
