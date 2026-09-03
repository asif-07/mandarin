"use client";

import Link from "next/link";
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill, INVOICE_TONES } from "@/components/shared/status-pill";
import { InvoiceActionsMenu } from "@/components/invoices/invoice-actions";
import { INVOICE_STATUSES, labelFor } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";

export type InvoiceListRow = {
  id: string;
  invoice_number: string;
  bill_to_name: string;
  issue_date: string;
  total: number;
  currency: string;
  status: string;
  created_by_name: string | null;
};

const columns: ColumnDef<InvoiceListRow>[] = [
  {
    accessorKey: "invoice_number",
    header: "Invoice",
    cell: ({ row }) => (
      <Link href={`/invoices/${row.original.id}`} className="font-medium text-mr-ink hover:underline">
        {row.original.invoice_number}
      </Link>
    ),
  },
  { accessorKey: "bill_to_name", header: "Bill to" },
  {
    accessorKey: "issue_date",
    header: "Issue date",
    cell: ({ getValue }) => <span className="tnum">{formatDate(getValue<string>())}</span>,
  },
  {
    accessorKey: "total",
    header: () => <div className="text-right">Total</div>,
    cell: ({ row }) => (
      <div className="tnum text-right font-medium">{formatMoney(row.original.total, row.original.currency)}</div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ getValue }) => {
      const s = getValue<string>();
      return <StatusPill label={labelFor(INVOICE_STATUSES, s)} tone={INVOICE_TONES[s]} />;
    },
  },
  {
    accessorKey: "created_by_name",
    header: "Created by",
    cell: ({ getValue }) => <span className="text-mr-body">{getValue<string | null>() ?? "—"}</span>,
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <div className="text-right">
        <InvoiceActionsMenu invoice={row.original} />
      </div>
    ),
  },
];

export function InvoiceTable({ rows }: { rows: InvoiceListRow[] }) {
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel(), manualPagination: true });

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-lg border border-mr-line md:block">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((h) => (
                  <TableHead key={h.id} className="micro-label h-10 bg-mr-surface">
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <ul className="space-y-3 md:hidden">
        {rows.map((inv) => (
          <li key={inv.id} className="rounded-lg border border-mr-line p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/invoices/${inv.id}`} className="block truncate font-medium text-mr-ink">
                  {inv.invoice_number}
                </Link>
                <p className="truncate text-sm text-mr-body">{inv.bill_to_name}</p>
              </div>
              <InvoiceActionsMenu invoice={inv} />
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="tnum text-mr-muted">{formatDate(inv.issue_date)}</span>
              <span className="tnum font-medium">{formatMoney(inv.total, inv.currency)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <StatusPill label={labelFor(INVOICE_STATUSES, inv.status)} tone={INVOICE_TONES[inv.status]} />
              <span className="text-xs text-mr-muted">{inv.created_by_name ?? ""}</span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
