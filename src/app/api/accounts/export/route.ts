import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, isAdmin } from "@/lib/auth";
import { PAYMENT_METHODS, labelFor } from "@/lib/constants";

export const dynamic = "force-dynamic";

function csv(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((r) =>
      r
        .map((v) => {
          const s = v === null || v === undefined ? "" : String(v);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\r\n");
}

/** CSV export of receipts or expenses for a date range. Admin only. */
export async function GET(request: NextRequest) {
  const current = await getCurrentProfile();
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(current.profile)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const params = request.nextUrl.searchParams;
  const type = params.get("type");
  const from = params.get("from");
  const to = params.get("to");
  const dateOk = (v: string | null) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (!dateOk(from) || !dateOk(to)) return NextResponse.json({ error: "Bad date" }, { status: 400 });

  const supabase = await createClient();
  let rows: (string | number | null | undefined)[][] = [];

  if (type === "receipts") {
    let q = supabase
      .from("receipts")
      .select("receipt_ref, received_on, amount, currency, applied_amount, method, payer_name, reference, notes, invoice:invoices(invoice_number, bill_to_name, currency), deal:deals(deal_ref, title), party:parties(name), ledger:bank_accounts(name)")
      .order("received_on")
      .limit(10000);
    if (from) q = q.gte("received_on", from);
    if (to) q = q.lte("received_on", to);
    const { data } = await q;
    rows = [
      ["Receipt", "Date", "Amount", "Currency", "Applied amount", "Applied currency", "Method", "Ledger", "Invoice", "Bill to", "Deal", "Partner", "Payer", "Reference", "Notes"],
      ...(data ?? []).map((r) => [
        r.receipt_ref,
        r.received_on,
        r.amount,
        r.currency,
        r.applied_amount,
        r.invoice?.currency ?? "",
        labelFor(PAYMENT_METHODS, r.method),
        r.ledger?.name,
        r.invoice?.invoice_number,
        r.invoice?.bill_to_name,
        r.deal ? `${r.deal.deal_ref} ${r.deal.title}` : "",
        r.party?.name,
        r.payer_name,
        r.reference,
        r.notes,
      ]),
    ];
  } else if (type === "expenses") {
    let q = supabase
      .from("expenses")
      .select("expense_ref, spent_on, paid_on, due_on, status, amount, currency, description, method, reference, notes, category:expense_categories(name), party:parties(name), deal:deals(deal_ref, title), ledger:bank_accounts(name)")
      .order("spent_on")
      .limit(10000);
    if (from) q = q.gte("spent_on", from);
    if (to) q = q.lte("spent_on", to);
    const { data } = await q;
    rows = [
      ["Expense", "Date", "Paid on", "Due on", "Status", "Amount", "Currency", "Category", "Description", "Supplier", "Deal", "Method", "Ledger", "Reference", "Notes"],
      ...(data ?? []).map((e) => [
        e.expense_ref,
        e.spent_on,
        e.paid_on,
        e.due_on,
        e.status,
        e.amount,
        e.currency,
        e.category?.name,
        e.description,
        e.party?.name,
        e.deal ? `${e.deal.deal_ref} ${e.deal.title}` : "",
        e.method ? labelFor(PAYMENT_METHODS, e.method) : "",
        e.ledger?.name,
        e.reference,
        e.notes,
      ]),
    ];
  } else {
    return NextResponse.json({ error: "type must be receipts or expenses" }, { status: 400 });
  }

  const name = `${type}${from ? `-${from}` : ""}${to ? `-${to}` : ""}.csv`;
  return new NextResponse("﻿" + csv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}
