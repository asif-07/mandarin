-- Atomic "claim a number and insert" functions. Each runs in a single
-- transaction so the counter increment and the row insert succeed or fail
-- together, and two users can never receive the same number.
-- SECURITY INVOKER: RLS still applies to the caller; next_counter itself is
-- SECURITY DEFINER so the counters table needs no direct access.

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
    'MR-' || p_year::text || '-' || n::text,
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

create or replace function public.update_invoice(p_id uuid, p_invoice jsonb, p_items jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  item jsonb;
  pos int := 0;
begin
  update public.invoices set
    issue_date = (p_invoice->>'issue_date')::date,
    due_date_label = coalesce(p_invoice->>'due_date_label', 'On Receipt'),
    currency = coalesce(p_invoice->>'currency', 'USD'),
    bill_to_name = p_invoice->>'bill_to_name',
    bill_to_phone = p_invoice->>'bill_to_phone',
    bill_to_email = p_invoice->>'bill_to_email',
    bill_to_address = p_invoice->>'bill_to_address',
    visa_reference = p_invoice->>'visa_reference',
    subtotal = coalesce((p_invoice->>'subtotal')::numeric, 0),
    tax = coalesce((p_invoice->>'tax')::numeric, 0),
    total = coalesce((p_invoice->>'total')::numeric, 0),
    amount_in_words = p_invoice->>'amount_in_words',
    terms = p_invoice->>'terms',
    status = coalesce(p_invoice->>'status', status),
    lead_id = nullif(p_invoice->>'lead_id', '')::uuid,
    customer_id = nullif(p_invoice->>'customer_id', '')::uuid,
    pdf_path = null            -- content changed: the stored PDF is stale
  where id = p_id;

  if not found then
    raise exception 'Invoice % not found', p_id;
  end if;

  delete from public.invoice_items where invoice_id = p_id;

  for item in select * from jsonb_array_elements(p_items) loop
    pos := pos + 1;
    insert into public.invoice_items (invoice_id, position, title, description, reference, quantity, rate, amount)
    values (
      p_id, pos, item->>'title', item->>'description', item->>'reference',
      (item->>'quantity')::numeric, (item->>'rate')::numeric, (item->>'amount')::numeric
    );
  end loop;

  return p_id;
end;
$$;

create or replace function public.create_lead(p_year int, p_lead jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  n int;
  new_id uuid;
begin
  n := public.next_counter('lead_' || p_year::text);

  insert into public.leads (
    lead_ref, customer_id, full_name, phone, email, country, city, entry_city,
    enquiry_type, source, status, pax_count, travel_month, canton_phase,
    quoted_amount, quoted_currency, assigned_to, next_followup_date, notes, created_by
  ) values (
    'LD-' || p_year::text || '-' || lpad(n::text, 4, '0'),
    nullif(p_lead->>'customer_id', '')::uuid,
    p_lead->>'full_name',
    p_lead->>'phone',
    p_lead->>'email',
    p_lead->>'country',
    p_lead->>'city',
    p_lead->>'entry_city',
    p_lead->>'enquiry_type',
    p_lead->>'source',
    coalesce(p_lead->>'status', 'new'),
    coalesce((p_lead->>'pax_count')::int, 1),
    p_lead->>'travel_month',
    p_lead->>'canton_phase',
    (p_lead->>'quoted_amount')::numeric,
    coalesce(p_lead->>'quoted_currency', 'USD'),
    nullif(p_lead->>'assigned_to', '')::uuid,
    (p_lead->>'next_followup_date')::date,
    p_lead->>'notes',
    auth.uid()
  )
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.create_traveller(p_year int, p_traveller jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  n int;
  new_id uuid;
begin
  n := public.next_counter('traveller_' || p_year::text);

  insert into public.travellers (
    traveller_ref, customer_id, lead_id, invoice_id, full_name, phone, email,
    passport_number, nationality, travel_start_date, travel_end_date,
    travel_group_id, visa_reference, status, notes, created_by
  ) values (
    'TR-' || p_year::text || '-' || lpad(n::text, 4, '0'),
    nullif(p_traveller->>'customer_id', '')::uuid,
    nullif(p_traveller->>'lead_id', '')::uuid,
    nullif(p_traveller->>'invoice_id', '')::uuid,
    p_traveller->>'full_name',
    p_traveller->>'phone',
    p_traveller->>'email',
    p_traveller->>'passport_number',
    p_traveller->>'nationality',
    (p_traveller->>'travel_start_date')::date,
    (p_traveller->>'travel_end_date')::date,
    nullif(p_traveller->>'travel_group_id', '')::uuid,
    p_traveller->>'visa_reference',
    coalesce(p_traveller->>'status', 'documents_pending'),
    p_traveller->>'notes',
    auth.uid()
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.create_invoice(int, jsonb, jsonb) from public;
revoke all on function public.update_invoice(uuid, jsonb, jsonb) from public;
revoke all on function public.create_lead(int, jsonb) from public;
revoke all on function public.create_traveller(int, jsonb) from public;
grant execute on function public.create_invoice(int, jsonb, jsonb) to authenticated;
grant execute on function public.update_invoice(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.create_lead(int, jsonb) to authenticated;
grant execute on function public.create_traveller(int, jsonb) to authenticated;
