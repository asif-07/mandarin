"use client";

import Link from "next/link";
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill, TRAVELLER_TONES } from "@/components/shared/status-pill";
import { TRAVELLER_STATUSES, labelFor } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type TravellerRow = {
  id: string;
  traveller_ref: string;
  full_name: string;
  travel_start_date: string;
  travel_end_date: string;
  group_title: string | null;
  group_date: string | null;
  status: string;
  docs_count: number;
  docs_total: number;
  visa_reference: string | null;
};

export function DocsBadge({ count, total }: { count: number; total: number }) {
  const complete = count >= total;
  return (
    <span className={cn("tnum inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium", complete ? "bg-mr-success/10 text-mr-success" : "bg-mr-warning/10 text-mr-warning")}>
      {count}/{total}
    </span>
  );
}

const columns: ColumnDef<TravellerRow>[] = [
  {
    accessorKey: "full_name",
    header: "Name",
    cell: ({ row }) => (
      <Link href={`/travel/travellers/${row.original.id}`} className="font-medium text-mr-ink hover:underline">
        {row.original.full_name}
        <span className="ml-2 font-mono text-[11px] font-normal text-mr-muted">{row.original.traveller_ref}</span>
      </Link>
    ),
  },
  {
    id: "dates",
    header: "Travel dates",
    cell: ({ row }) => (
      <span className="tnum whitespace-nowrap">
        {formatDate(row.original.travel_start_date)} – {formatDate(row.original.travel_end_date)}
      </span>
    ),
  },
  {
    accessorKey: "group_title",
    header: "Group",
    cell: ({ row }) =>
      row.original.group_title ? (
        <Link href={`/travel?date=${row.original.group_date}`} className="hover:underline">
          {row.original.group_title}
        </Link>
      ) : (
        <span className="text-mr-muted">—</span>
      ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ getValue }) => <StatusPill label={labelFor(TRAVELLER_STATUSES, getValue<string>())} tone={TRAVELLER_TONES[getValue<string>()]} />,
  },
  {
    id: "docs",
    header: "Documents",
    cell: ({ row }) => <DocsBadge count={row.original.docs_count} total={row.original.docs_total} />,
  },
  {
    accessorKey: "visa_reference",
    header: "Visa ref",
    cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string | null>() ?? "—"}</span>,
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <Link href={`/travel/travellers/${row.original.id}`} className="text-xs font-medium text-mr-ink hover:underline">
        Open
      </Link>
    ),
  },
];

export function TravellerTable({ rows }: { rows: TravellerRow[] }) {
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel(), manualPagination: true });
  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-mr-line md:block">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((h) => (
                  <TableHead key={h.id} className="micro-label h-10 whitespace-nowrap bg-mr-surface">
                    {flexRender(h.column.columnDef.header, h.getContext())}
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
      <ul className="space-y-3 md:hidden">
        {rows.map((t) => (
          <li key={t.id} className="rounded-lg border border-mr-line p-4">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/travel/travellers/${t.id}`} className="min-w-0 truncate font-medium text-mr-ink">
                {t.full_name}
              </Link>
              <DocsBadge count={t.docs_count} total={t.docs_total} />
            </div>
            <p className="tnum mt-1 text-sm text-mr-body">
              {formatDate(t.travel_start_date)} – {formatDate(t.travel_end_date)}
            </p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <StatusPill label={labelFor(TRAVELLER_STATUSES, t.status)} tone={TRAVELLER_TONES[t.status]} />
              <span className="truncate text-xs text-mr-muted">{t.group_title ?? "No group"}</span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
