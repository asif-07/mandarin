-- Invoice numbers are now MRINVC-{year}-{n}. Existing invoices keep their old numbers; the counter continues.
create or replace function public.create_invoice(p_year int, p_invoice jsonb, p_items jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  n int;
  new_id uuid;
  item jsonb;
  pos int := 0;
begin
  n := public.next_counter('invoice_' || p_year::text);

  insert into public.invoices (
    invoice_number, sequence_number, issue_date, due_date_label, currency,
    bill_to_name, bill_to_phone, bill_to_email, bill_to_address, visa_reference,
    subtotal, tax, total, amount_in_words, terms, status, lead_id, customer_id, created_by
  ) values (
    'MRINVC-' || p_year::text || '-' || n::text,
    n,
    (p_invoice->>'issue_date')::date,
    coalesce(p_invoice->>'due_date_label', 'On Receipt'),
    coalesce(p_invoice->>'currency', 'USD'),
    p_invoice->>'bill_to_name',
    p_invoice->>'bill_to_phone',
    p_invoice->>'bill_to_email',
    p_invoice->>'bill_to_address',
    p_invoice->>'visa_reference',
    coalesce((p_invoice->>'subtotal')::numeric, 0),
    coalesce((p_invoice->>'tax')::numeric, 0),
    coalesce((p_invoice->>'total')::numeric, 0),
    p_invoice->>'amount_in_words',
    p_invoice->>'terms',
    coalesce(p_invoice->>'status', 'issued'),
    nullif(p_invoice->>'lead_id', '')::uuid,
    nullif(p_invoice->>'customer_id', '')::uuid,
    auth.uid()
  )
  returning id into new_id;

  for item in select * from jsonb_array_elements(p_items) loop
    pos := pos + 1;
    insert into public.invoice_items (invoice_id, position, title, description, reference, quantity, rate, amount)
    values (
      new_id, pos, item->>'title', item->>'description', item->>'reference',
      (item->>'quantity')::numeric, (item->>'rate')::numeric, (item->>'amount')::numeric
    );
  end loop;

  return new_id;
end;
$$;
