import type { Metadata } from "next";
import { Landmark, Wallet, Banknote } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MoneyStat } from "@/components/accounts/money";
import { DeleteTransferButton, LedgerRowActions, NewLedgerButton, TransferButton, type LedgerRecord } from "@/components/accounts/ledger-dialog";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { getLedgers, sumByCurrency } from "@/lib/queries/accounts";
import { BANK_ACCOUNT_TYPES, labelFor } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Cash & bank" };

const ICONS = { bank: Landmark, cash: Banknote, wallet: Wallet } as const;

export default async function LedgersPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [ledgers, { data: rawLedgers }, { data: transfers }] = await Promise.all([
    getLedgers(supabase, true),
    supabase.from("bank_accounts").select("*").order("name"),
    supabase
      .from("account_transfers")
      .select("*, from_account:bank_accounts!account_transfers_from_account_id_fkey(name, currency), to_account:bank_accounts!account_transfers_to_account_id_fkey(name, currency)")
      .order("transferred_on", { ascending: false })
      .limit(50),
  ]);
  const active = ledgers.filter((l) => l.is_active);
  const byId = new Map((rawLedgers ?? []).map((l) => [l.id, l]));

  return (
    <>
      <PageHeader
        title="Cash & bank"
        description="Running balance of every account, cash box and wallet. Receipts add, paid expenses subtract, transfers move money between them."
        actions={
          <>
            <TransferButton />
            <NewLedgerButton />
          </>
        }
      />

      {ledgers.length === 0 ? (
        <EmptyState icon={Landmark} title="No ledgers yet. Add each bank account, your cash box and wallets like WeChat Pay, with their opening balance." action={<NewLedgerButton />} />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MoneyStat label="Total cash & bank" totals={sumByCurrency(active, (l) => l.balance)} tone="auto" hint="active ledgers, per currency" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {ledgers.map((l) => {
              const raw = byId.get(l.id);
              const Icon = ICONS[l.account_type as keyof typeof ICONS] ?? Landmark;
              const record: LedgerRecord & { id: string } = {
                id: l.id,
                name: l.name,
                account_type: l.account_type,
                currency: l.currency,
                opening_balance: String(l.opening_balance),
                opening_date: raw?.opening_date ?? "",
                bank_name: l.bank_name ?? "",
                account_number: l.account_number ?? "",
                notes: raw?.notes ?? "",
                is_active: l.is_active,
              };
              return (
                <div key={l.id} className={cn("rounded-lg border border-mr-line bg-white p-5", !l.is_active && "opacity-60")}>
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-mr-surface">
                      <Icon className="size-4 text-mr-body" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-mr-ink">{l.name}</p>
                      <p className="truncate text-xs text-mr-muted">
                        {labelFor(BANK_ACCOUNT_TYPES, l.account_type)} · {l.currency}
                        {l.bank_name ? ` · ${l.bank_name}` : ""}
                        {l.account_number ? ` · ${l.account_number}` : ""}
                        {!l.is_active ? " · inactive" : ""}
                      </p>
                    </div>
                    <LedgerRowActions ledger={record} />
                  </div>
                  <p className={cn("tnum mt-4 font-heading text-2xl font-semibold", l.balance < 0 ? "text-mr-red" : "text-mr-ink")}>{formatMoney(l.balance, l.currency)}</p>
                  <p className="mt-1 text-xs text-mr-muted">
                    opened {raw?.opening_date ? formatDate(raw.opening_date) : ""} with {formatMoney(l.opening_balance, l.currency)}
                  </p>
                </div>
              );
            })}
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Transfers</CardTitle>
            </CardHeader>
            <CardContent>
              {!transfers || transfers.length === 0 ? (
                <p className="text-sm text-mr-muted">No transfers yet. Use Transfer when you deposit cash into the bank or move money between accounts.</p>
              ) : (
                <ul className="divide-y divide-mr-line">
                  {transfers.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 py-2.5 text-sm">
                      <span className="tnum w-24 shrink-0 text-xs text-mr-muted">{formatDate(t.transferred_on)}</span>
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium text-mr-ink">{t.from_account?.name}</span>
                        <span className="text-mr-muted"> → </span>
                        <span className="font-medium text-mr-ink">{t.to_account?.name}</span>
                        {t.reference && <span className="ml-2 text-xs text-mr-muted">{t.reference}</span>}
                      </span>
                      <span className="tnum whitespace-nowrap">
                        {formatMoney(t.amount_out, t.from_account?.currency ?? "USD")}
                        {t.from_account?.currency !== t.to_account?.currency && <span className="text-mr-muted"> → {formatMoney(t.amount_in, t.to_account?.currency ?? "USD")}</span>}
                      </span>
                      <DeleteTransferButton id={t.id} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
