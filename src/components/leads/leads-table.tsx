"use client";

import Link from "next/link";
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill, LEAD_TONES } from "@/components/shared/status-pill";
import { enquiryShort, followupDue, type KanbanLead } from "@/components/leads/lead-card";
import { COUNTRIES, LEAD_STATUSES, labelFor } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

const columns: ColumnDef<KanbanLead>[] = [
  {
    accessorKey: "lead_ref",
    header: "Ref",
    cell: ({ row }) => (
      <Link href={`/leads/${row.original.id}`} className="font-mono text-xs text-mr-body hover:underline">
        {row.original.lead_ref}
      </Link>
    ),
  },
  {
    accessorKey: "full_name",
    header: "Name",
    cell: ({ row }) => (
      <Link href={`/leads/${row.original.id}`} className="font-medium text-mr-ink hover:underline">
        {row.original.full_name}
      </Link>
    ),
  },
  { accessorKey: "phone", header: "Phone", cell: ({ getValue }) => <span className="tnum">{getValue<string>()}</span> },
  {
    accessorKey: "enquiry_type",
    header: "Enquiry",
    cell: ({ row }) => enquiryShort(row.original.enquiry_type, row.original.package_tier),
  },
  {
    accessorKey: "country",
    header: "Country",
    cell: ({ getValue }) => {
      const c = COUNTRIES.find((x) => x.value === getValue<string | null>());
      return c ? `${c.flag} ${c.label}` : "—";
    },
  },
  {
    accessorKey: "quoted_amount",
    header: () => <div className="text-right">Quote</div>,
    cell: ({ row }) => (
      <div className="tnum text-right">
        {row.original.quoted_amount != null ? formatMoney(row.original.quoted_amount, row.original.quoted_currency ?? "USD") : "—"}
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ getValue }) => <StatusPill label={labelFor(LEAD_STATUSES, getValue<string>())} tone={LEAD_TONES[getValue<string>()]} />,
  },
  {
    accessorKey: "next_followup_date",
    header: "Follow-up",
    cell: ({ getValue }) => {
      const v = getValue<string | null>();
      return (
        <span className={cn("tnum", followupDue(v) && "font-medium text-mr-red")}>{v ? formatDate(v) : "—"}</span>
      );
    },
  },
  { accessorKey: "assigned_name", header: "Owner", cell: ({ getValue }) => getValue<string | null>() ?? "—" },
  {
    accessorKey: "created_at",
    header: "Added",
    cell: ({ getValue }) => <span className="tnum text-mr-body">{formatDate(getValue<string | null>())}</span>,
  },
];

export function LeadsTable({ rows }: { rows: KanbanLead[] }) {
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
                  <TableCell key={cell.id} className="whitespace-nowrap py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="space-y-3 md:hidden">
        {rows.map((lead) => (
          <li key={lead.id} className="rounded-lg border border-mr-line p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/leads/${lead.id}`} className="block truncate font-medium text-mr-ink">
                  {lead.full_name}
                </Link>
                <p className="tnum text-sm text-mr-body">{lead.phone}</p>
              </div>
              <StatusPill label={labelFor(LEAD_STATUSES, lead.status)} tone={LEAD_TONES[lead.status]} />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-mr-body">
              <span>{enquiryShort(lead.enquiry_type, lead.package_tier)}</span>
              <span className={cn("tnum", followupDue(lead.next_followup_date) && "font-medium text-mr-red")}>
                {lead.next_followup_date ? `Follow-up ${formatDate(lead.next_followup_date)}` : ""}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
