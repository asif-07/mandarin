"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Download, FileUp, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { bulkCreateLeads, type BulkLeadResult } from "@/lib/actions/leads";
import { leadSchema, type LeadInput } from "@/lib/validation/lead";
import { LEAD_CSV_COLUMNS, MAX_IMPORT_ROWS, leadTemplateCsv, mapHeaders, normaliseRow, parseCsv } from "@/lib/leads/csv";
import { ENQUIRY_TYPES, LEAD_SOURCES, LEAD_STATUSES, labelFor } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { z } from "zod";

type Profile = { id: string; username: string; display_name: string };

type PreviewRow = {
  n: number;
  input: LeadInput;
  errors: string[];
  warnings: string[];
};

export function LeadImport({ profiles }: { profiles: Profile[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [unmapped, setUnmapped] = useState<string[]>([]);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [skipExisting, setSkipExisting] = useState(true);
  const [result, setResult] = useState<BulkLeadResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function load(file: File) {
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const table = parseCsv(text);
      if (table.length < 2) return void toast.error("The file needs a header row and at least one lead");
      const keys = mapHeaders(table[0]!);
      setHeaders(table[0]!);
      setUnmapped(table[0]!.filter((_, i) => keys[i] === null));
      const body = table.slice(1, MAX_IMPORT_ROWS + 1);
      if (table.length - 1 > MAX_IMPORT_ROWS) toast.warning(`Only the first ${MAX_IMPORT_ROWS} rows are loaded`);
      setRows(
        body.map((cells, i) => {
          const { input, warnings } = normaliseRow(cells, keys, profiles);
          const parsed = leadSchema.safeParse(input);
          const errors = parsed.success
            ? []
            : Object.entries(z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>).map(([k, v]) => `${labelForKey(k)}: ${v?.[0] ?? "invalid"}`);
          return { n: i + 1, input, errors, warnings };
        }),
      );
      setFileName(file.name);
    };
    reader.readAsText(file);
  }

  const valid = useMemo(() => rows.filter((r) => r.errors.length === 0), [rows]);
  const invalid = rows.length - valid.length;
  const missingRequired = LEAD_CSV_COLUMNS.filter((c) => c.required && !mapHeaders(headers).includes(c.key)).map((c) => c.label);

  function submit() {
    if (valid.length === 0) return;
    startTransition(async () => {
      const res = await bulkCreateLeads(
        valid.map((r) => r.input),
        { skipExistingPhones: skipExisting },
      );
      if (!res.ok) return void toast.error(res.error);
      setResult(res.data);
      toast.success(`${res.data.created} lead${res.data.created === 1 ? "" : "s"} imported`);
      router.refresh();
    });
  }

  function downloadTemplate() {
    const blob = new Blob(["﻿" + leadTemplateCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div
          className="flex flex-col items-center justify-center rounded-lg border border-dashed border-mr-line px-6 py-10 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) load(f);
          }}
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-mr-surface">
            <FileUp className="size-5 text-mr-muted" />
          </div>
          <p className="mt-4 text-sm text-mr-body">{fileName ? `Loaded ${fileName}` : "Drop a CSV here, or choose a file"}</p>
          <p className="mt-1 text-xs text-mr-muted">Export from Excel or Google Sheets as CSV. Up to {MAX_IMPORT_ROWS} rows per import.</p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) load(f);
              e.target.value = "";
            }}
          />
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button onClick={() => fileRef.current?.click()} disabled={pending}>
              <Upload /> Choose CSV
            </Button>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download /> Download template
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-mr-line p-4 text-sm">
          <p className="font-medium text-mr-ink">Columns</p>
          <ul className="mt-2 space-y-1 text-xs text-mr-body">
            {LEAD_CSV_COLUMNS.map((c) => (
              <li key={c.key}>
                <span className={cn("font-medium", c.required ? "text-mr-ink" : "")}>{c.label}</span>
                {c.required && <span className="text-mr-red"> *</span>}
                {"hint" in c && c.hint ? <span className="text-mr-muted"> · {c.hint}</span> : null}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-mr-muted">Headers are matched by name, in any order. Values like &ldquo;WhatsApp&rdquo; or &ldquo;144hr Visa&rdquo; are accepted as written in the app.</p>
        </div>
      </div>

      {rows.length > 0 && (
        <>
          {(missingRequired.length > 0 || unmapped.length > 0) && (
            <div className="rounded-lg border border-mr-warning/40 bg-mr-warning/5 p-4 text-sm">
              {missingRequired.length > 0 && (
                <p className="flex items-center gap-2 text-mr-warning">
                  <AlertTriangle className="size-4" /> Missing required column{missingRequired.length === 1 ? "" : "s"}: {missingRequired.join(", ")}
                </p>
              )}
              {unmapped.length > 0 && <p className="mt-1 text-xs text-mr-body">Ignored columns: {unmapped.join(", ")}</p>}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-mr-body">
              <span className="font-medium text-mr-ink">{rows.length}</span> row{rows.length === 1 ? "" : "s"} · <span className="font-medium text-mr-success">{valid.length} ready</span>
              {invalid > 0 && (
                <>
                  {" · "}
                  <span className="font-medium text-mr-red">{invalid} with errors</span> (skipped)
                </>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={skipExisting} onCheckedChange={(v) => setSkipExisting(v === true)} />
                Skip phones already in leads
              </label>
              <Button onClick={submit} disabled={pending || valid.length === 0 || !!result}>
                {pending && <Loader2 className="animate-spin" />} Import {valid.length} lead{valid.length === 1 ? "" : "s"}
              </Button>
            </div>
          </div>

          {result && (
            <div className="rounded-lg border border-mr-success/40 bg-mr-success/5 p-4 text-sm">
              <p className="flex items-center gap-2 font-medium text-mr-success">
                <CheckCircle2 className="size-4" /> {result.created} imported
                {result.skipped ? `, ${result.skipped} skipped (phone already existed)` : ""}
                {result.failed.length ? `, ${result.failed.length} failed` : ""}
              </p>
              {result.failed.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-mr-red">
                  {result.failed.map((f) => (
                    <li key={f.row}>
                      Row {f.row}: {f.error}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs">
                <Link href="/leads?view=table" className="underline">
                  Open the leads table
                </Link>
              </p>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-mr-line">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="micro-label h-10 bg-mr-surface">#</TableHead>
                  <TableHead className="micro-label h-10 bg-mr-surface">Name</TableHead>
                  <TableHead className="micro-label h-10 bg-mr-surface">Phone</TableHead>
                  <TableHead className="micro-label h-10 bg-mr-surface">Enquiry</TableHead>
                  <TableHead className="micro-label h-10 bg-mr-surface">Source</TableHead>
                  <TableHead className="micro-label h-10 bg-mr-surface">Status</TableHead>
                  <TableHead className="micro-label h-10 bg-mr-surface">Country</TableHead>
                  <TableHead className="micro-label h-10 bg-mr-surface">Check</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.n} className={r.errors.length ? "bg-mr-red/5" : ""}>
                    <TableCell className="tnum py-2 text-xs text-mr-muted">{r.n}</TableCell>
                    <TableCell className="py-2 font-medium">{r.input.full_name || <span className="text-mr-muted">—</span>}</TableCell>
                    <TableCell className="tnum py-2">{r.input.phone}</TableCell>
                    <TableCell className="py-2">
                      {labelFor(ENQUIRY_TYPES, r.input.enquiry_type as never) || r.input.enquiry_type}
                      {r.input.package_tier ? ` · ${r.input.package_tier.replace("_", " ")}` : ""}
                    </TableCell>
                    <TableCell className="py-2">{labelFor(LEAD_SOURCES, r.input.source as never) || r.input.source}</TableCell>
                    <TableCell className="py-2">{labelFor(LEAD_STATUSES, r.input.status as never) || r.input.status}</TableCell>
                    <TableCell className="py-2">{r.input.country ?? ""}</TableCell>
                    <TableCell className="py-2 text-xs">
                      {r.errors.length > 0 ? (
                        <span className="text-mr-red">{r.errors.join("; ")}</span>
                      ) : r.warnings.length > 0 ? (
                        <span className="text-mr-warning">{r.warnings.join("; ")}</span>
                      ) : (
                        <span className="text-mr-success">OK</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {rows.length === 0 && (
        <p className="text-xs text-mr-muted">
          Tip: export the current list first with <Link href="/api/leads/export" className={buttonVariants({ variant: "link", size: "sm" }) + " h-auto p-0 text-xs"}>Export CSV</Link> to see the exact format, then reuse it as a template.
        </p>
      )}
    </div>
  );
}

function labelForKey(k: string): string {
  return LEAD_CSV_COLUMNS.find((c) => c.key === k)?.label ?? k;
}
