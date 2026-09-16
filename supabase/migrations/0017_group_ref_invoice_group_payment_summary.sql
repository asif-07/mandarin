-- 1. Stable Group ID on every travel group: PREFIX-[PARTNER-]MONDD-MONDD-Gnn (e.g. MR144-SEP15-SEP20-G01).
--    Kept by trigger so it follows date / code / prefix edits; backfilled for existing rows.
alter table public.travel_groups add column if not exists group_ref text;

create or replace function public.travel_group_ref(p_prefix text, p_partner text, p_source text, p_start date, p_end date, p_code text)
returns text language sql stable as $$
  select upper(coalesce(nullif(p_prefix, ''), 'MR144')) || '-'
      || case when p_source = 'b2b' and nullif(p_partner, '') is not null then upper(p_partner) || '-' else '' end
      || upper(to_char(p_start, 'Mon')) || to_char(p_start, 'DD') || '-'
      || upper(to_char(coalesce(p_end, p_start), 'Mon')) || to_char(coalesce(p_end, p_start), 'DD') || '-'
      || upper(p_code)
$$;

create or replace function public.set_travel_group_ref() returns trigger language plpgsql as $$
begin
  new.group_ref := public.travel_group_ref(new.reference_prefix, new.partner_code, new.source, new.travel_date, new.travel_end_date, new.group_code);
  return new;
end $$;

drop trigger if exists travel_groups_set_ref on public.travel_groups;
create trigger travel_groups_set_ref
  before insert or update of travel_date, travel_end_date, group_code, reference_prefix, partner_code, source
  on public.travel_groups for each row execute function public.set_travel_group_ref();

update public.travel_groups
  set group_ref = public.travel_group_ref(reference_prefix, partner_code, source, travel_date, travel_end_date, group_code);
create index if not exists travel_groups_group_ref_idx on public.travel_groups (group_ref);

-- 2. Invoices can point at a travel group (printed as "Group" on the invoice).
alter table public.invoices add column if not exists travel_group_id uuid references public.travel_groups(id) on delete set null;
create index if not exists invoices_travel_group_idx on public.invoices (travel_group_id) where travel_group_id is not null;

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
    subtotal, tax, total, amount_in_words, terms, status, lead_id, customer_id, travel_group_id, created_by
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
    nullif(p_invoice->>'travel_group_id', '')::uuid,
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
    travel_group_id = nullif(p_invoice->>'travel_group_id', '')::uuid,
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

-- 3. Received / balance per invoice for every signed-in user (receipts themselves stay admin-only).
create or replace function public.invoice_payment_summary(p_ids uuid[])
returns table (invoice_id uuid, received numeric, balance numeric, receipt_count int)
language sql stable security definer set search_path = public as $$
  select i.id,
         coalesce(sum(r.applied_amount), 0)::numeric(14,2),
         (i.total - coalesce(sum(r.applied_amount), 0))::numeric(14,2),
         count(r.id)::int
  from public.invoices i
  left join public.receipts r on r.invoice_id = i.id
  where i.id = any(p_ids)
  group by i.id, i.total
$$;
revoke all on function public.invoice_payment_summary(uuid[]) from public, anon;
grant execute on function public.invoice_payment_summary(uuid[]) to authenticated;
