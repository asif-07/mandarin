"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CsvRow = Record<string, string | number | null | undefined>;

/** Downloads the current list as a CSV file (one line per passenger). */
export function ExportCsvButton({ rows, fileName = "visa-applications.csv" }: { rows: CsvRow[]; fileName?: string }) {
  function download() {
    if (rows.length === 0) return;
    const cols = Object.keys(rows[0]!);
    const esc = (v: string | number | null | undefined) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Button type="button" variant="outline" onClick={download} disabled={rows.length === 0} title={rows.length ? `${rows.length} passenger rows` : "Nothing to export"}>
      <Download /> Export CSV
    </Button>
  );
}
