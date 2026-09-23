-- Record a full or part payment against an issued invoice from anywhere in the
-- app (group cards, dashboard, invoice list), not only from Accounts.
--
-- Receipts are admin-only under RLS, so this runs as security definer: any
-- signed-in staff member can record a payment, but only against an issued
-- invoice, only for a positive amount, and never for more than the balance.
-- The existing receipts triggers assign the receipt reference, copy the
-- invoice's deal and currency, and flip the invoice to paid once receipts
-- cover the total (and back to issued if a receipt is later removed).
create or replace function public.record_invoice_payment(
  p_invoice uuid,
  p_amount numeric,
  p_received_on date default current_date,
  p_method text default 'bank_transfer',
  p_reference text default null,
  p_notes text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
  received numeric;
  rec record;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than 0';
  end if;

  select i.id, i.total, i.currency, i.status, i.bill_to_name
    into inv
    from public.invoices i
   where i.id = p_invoice
     for update;
  if not found then
    raise exception 'Invoice not found';
  end if;
  if inv.status <> 'issued' then
    raise exception 'Only an issued invoice can take a payment (this one is %)', inv.status;
  end if;

  select coalesce(sum(r.applied_amount), 0) into received from public.receipts r where r.invoice_id = inv.id;
  if p_amount > (inv.total - received) + 0.005 then
    raise exception 'Amount is more than the balance due (% %)', inv.currency, to_char(inv.total - received, 'FM999999999990.00');
  end if;

  insert into public.receipts (receipt_ref, received_on, amount, currency, applied_amount, method, invoice_id, payer_name, reference, notes, created_by)
  values (
    '',
    coalesce(p_received_on, current_date),
    round(p_amount, 2),
    inv.currency,
    round(p_amount, 2),
    case when p_method in ('bank_transfer', 'cash', 'card', 'wechat', 'alipay', 'other') then p_method else 'bank_transfer' end,
    inv.id,
    inv.bill_to_name,
    nullif(btrim(coalesce(p_reference, '')), ''),
    nullif(btrim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  returning id, receipt_ref into rec;

  select coalesce(sum(r.applied_amount), 0) into received from public.receipts r where r.invoice_id = inv.id;
  return json_build_object(
    'receipt_id', rec.id,
    'receipt_ref', rec.receipt_ref,
    'received', received,
    'balance', greatest(inv.total - received, 0),
    'paid', received >= inv.total
  );
end;
$$;

revoke all on function public.record_invoice_payment(uuid, numeric, date, text, text, text) from public, anon;
grant execute on function public.record_invoice_payment(uuid, numeric, date, text, text, text) to authenticated;
