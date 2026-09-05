-- Accounts module
--
--   parties            B2B partners (agencies, corporate clients) and suppliers
--   deals              B2B deals with a partner; invoices, receipts and costs hang off a deal
--   bank_accounts      cash, bank and wallet ledgers (one currency each)
--   receipts           money IN: settles an invoice, a deal, or stands alone
--   expenses           money OUT: paid, or unpaid (= a payable to a supplier)
--   account_transfers  money moved between two ledgers
--   expense_categories editable list used to group expenses in reports
--
-- Access: every table here is readable and writable ONLY by profiles with
-- role = 'admin' (ambro, asif). Enforced by RLS through public.is_admin(),
-- so a sales/document session gets zero rows even if the UI is bypassed.
-- Invoices stay shared: they gain an optional deal_id so a deal can be
-- invoiced from the normal invoicing screen.

-- ---------------------------------------------------------------------------
-- role helper
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce((select p.role = 'admin' from public.profiles p where p.id = auth.uid()), false);
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- parties
-- ---------------------------------------------------------------------------
create table public.parties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  party_type text not null check (party_type in ('b2b_partner', 'supplier', 'both')),
  contact_name text,
  phone text,
  email text,
  address text,
  country text,
  default_currency text not null default 'USD' check (default_currency in ('USD', 'AED', 'CNY', 'INR')),
  payment_terms text,                               -- free text, e.g. "50% advance, balance before travel"
  notes text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index parties_name_key on public.parties (lower(name));
create index parties_type_idx on public.parties (party_type) where is_active;

-- ---------------------------------------------------------------------------
-- bank / cash / wallet ledgers
-- ---------------------------------------------------------------------------
create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,                               -- "ICBC CNY", "Cash USD", "WeChat Pay"
  account_type text not null check (account_type in ('bank', 'cash', 'wallet')),
  currency text not null check (currency in ('USD', 'AED', 'CNY', 'INR')),
  opening_balance numeric(14,2) not null default 0,
  opening_date date not null default current_date,
  bank_name text,
  account_number text,
  notes text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index bank_accounts_name_key on public.bank_accounts (lower(name));

-- ---------------------------------------------------------------------------
-- B2B deals
-- ---------------------------------------------------------------------------
create table public.deals (
  id uuid primary key default gen_random_uuid(),
  deal_ref text unique not null,                    -- DL-2026-0001 (assigned by trigger)
  party_id uuid not null references public.parties(id) on delete restrict,
  title text not null,
  description text,
  status text not null default 'active' check (status in ('draft', 'active', 'completed', 'cancelled')),
  currency text not null default 'USD' check (currency in ('USD', 'AED', 'CNY', 'INR')),
  deal_value numeric(14,2) not null default 0 check (deal_value >= 0),
  pax_count int check (pax_count is null or pax_count >= 0),
  start_date date,
  end_date date,
  payment_due_on date,                              -- when the partner is expected to settle
  travel_group_id uuid references public.travel_groups(id) on delete set null,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create index deals_party_idx on public.deals (party_id);
create index deals_status_idx on public.deals (status);
create index deals_start_idx on public.deals (start_date desc);

alter table public.invoices add column deal_id uuid references public.deals(id) on delete set null;
create index invoices_deal_idx on public.invoices (deal_id) where deal_id is not null;

-- ---------------------------------------------------------------------------
-- expense categories
-- ---------------------------------------------------------------------------
create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 100,
  is_active boolean not null default true
);

create unique index expense_categories_name_key on public.expense_categories (lower(name));

insert into public.expense_categories (name, sort_order) values
  ('Visa & government fees', 10),
  ('Hotel', 20),
  ('Flights', 30),
  ('Ground transport', 40),
  ('Guide & staff', 50),
  ('Meals & entertainment', 60),
  ('Office & rent', 70),
  ('Salaries', 80),
  ('Marketing', 90),
  ('Bank charges', 100),
  ('Commission paid', 110),
  ('Refund to customer', 120),
  ('Other', 999);

-- ---------------------------------------------------------------------------
-- receipts (money in)
-- ---------------------------------------------------------------------------
create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_ref text unique not null,                 -- RC-2026-0001 (assigned by trigger)
  received_on date not null default current_date,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null check (currency in ('USD', 'AED', 'CNY', 'INR')),
  -- Amount credited against the linked invoice/deal, in THAT record's currency.
  -- Equals `amount` when the currencies match; entered by hand otherwise
  -- (e.g. AED received against a USD invoice).
  applied_amount numeric(14,2) check (applied_amount is null or applied_amount > 0),
  method text not null default 'bank_transfer' check (method in ('bank_transfer', 'cash', 'card', 'wechat', 'alipay', 'other')),
  bank_account_id uuid references public.bank_accounts(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  party_id uuid references public.parties(id) on delete set null,
  payer_name text,                                  -- who paid, when not obvious from the links
  reference text,                                   -- bank / transaction reference
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index receipts_date_idx on public.receipts (received_on desc);
create index receipts_invoice_idx on public.receipts (invoice_id) where invoice_id is not null;
create index receipts_deal_idx on public.receipts (deal_id) where deal_id is not null;
create index receipts_party_idx on public.receipts (party_id) where party_id is not null;
create index receipts_account_idx on public.receipts (bank_account_id) where bank_account_id is not null;

-- ---------------------------------------------------------------------------
-- expenses (money out; unpaid = payable)
-- ---------------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_ref text unique not null,                 -- EX-2026-0001 (assigned by trigger)
  spent_on date not null default current_date,      -- date the cost was incurred
  amount numeric(14,2) not null check (amount > 0),
  currency text not null check (currency in ('USD', 'AED', 'CNY', 'INR')),
  category_id uuid not null references public.expense_categories(id) on delete restrict,
  description text not null,
  party_id uuid references public.parties(id) on delete set null,          -- supplier
  deal_id uuid references public.deals(id) on delete set null,             -- cost of a B2B deal
  travel_group_id uuid references public.travel_groups(id) on delete set null,
  status text not null default 'paid' check (status in ('unpaid', 'paid')),
  due_on date,
  paid_on date,
  method text check (method is null or method in ('bank_transfer', 'cash', 'card', 'wechat', 'alipay', 'other')),
  bank_account_id uuid references public.bank_accounts(id) on delete set null,
  reference text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (status <> 'paid' or paid_on is not null)
);

create index expenses_date_idx on public.expenses (spent_on desc);
create index expenses_status_idx on public.expenses (status, due_on);
create index expenses_category_idx on public.expenses (category_id);
create index expenses_party_idx on public.expenses (party_id) where party_id is not null;
create index expenses_deal_idx on public.expenses (deal_id) where deal_id is not null;
create index expenses_group_idx on public.expenses (travel_group_id) where travel_group_id is not null;
create index expenses_account_idx on public.expenses (bank_account_id) where bank_account_id is not null;

-- ---------------------------------------------------------------------------
-- transfers between ledgers
-- ---------------------------------------------------------------------------
create table public.account_transfers (
  id uuid primary key default gen_random_uuid(),
  transferred_on date not null default current_date,
  from_account_id uuid not null references public.bank_accounts(id) on delete restrict,
  to_account_id uuid not null references public.bank_accounts(id) on delete restrict,
  amount_out numeric(14,2) not null check (amount_out > 0),   -- in the source ledger's currency
  amount_in numeric(14,2) not null check (amount_in > 0),     -- in the destination ledger's currency
  reference text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  check (from_account_id <> to_account_id)
);

create index account_transfers_date_idx on public.account_transfers (transferred_on desc);
create index account_transfers_from_idx on public.account_transfers (from_account_id);
create index account_transfers_to_idx on public.account_transfers (to_account_id);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create trigger parties_set_updated_at before update on public.parties
  for each row execute function public.set_updated_at();
create trigger bank_accounts_set_updated_at before update on public.bank_accounts
  for each row execute function public.set_updated_at();
create trigger deals_set_updated_at before update on public.deals
  for each row execute function public.set_updated_at();
create trigger receipts_set_updated_at before update on public.receipts
  for each row execute function public.set_updated_at();
create trigger expenses_set_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- sequential references: DL-, RC-, EX- + year + 4 digits, claimed atomically
-- through next_counter() inside the inserting transaction
-- ---------------------------------------------------------------------------
create or replace function public.assign_accounts_ref()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  yr text;
  n int;
begin
  if tg_table_name = 'deals' then
    if new.deal_ref is null or new.deal_ref = '' then
      yr := to_char(coalesce(new.start_date, current_date), 'YYYY');
      n := public.next_counter('deal_' || yr);
      new.deal_ref := 'DL-' || yr || '-' || lpad(n::text, 4, '0');
    end if;
  elsif tg_table_name = 'receipts' then
    if new.receipt_ref is null or new.receipt_ref = '' then
      yr := to_char(coalesce(new.received_on, current_date), 'YYYY');
      n := public.next_counter('receipt_' || yr);
      new.receipt_ref := 'RC-' || yr || '-' || lpad(n::text, 4, '0');
    end if;
  elsif tg_table_name = 'expenses' then
    if new.expense_ref is null or new.expense_ref = '' then
      yr := to_char(coalesce(new.spent_on, current_date), 'YYYY');
      n := public.next_counter('expense_' || yr);
      new.expense_ref := 'EX-' || yr || '-' || lpad(n::text, 4, '0');
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.assign_accounts_ref() from public, anon, authenticated;

create trigger deals_assign_ref before insert on public.deals
  for each row execute function public.assign_accounts_ref();
create trigger receipts_assign_ref before insert on public.receipts
  for each row execute function public.assign_accounts_ref();
create trigger expenses_assign_ref before insert on public.expenses
  for each row execute function public.assign_accounts_ref();

-- ---------------------------------------------------------------------------
-- receipt consistency: inherit deal/party from the invoice, default the
-- applied amount, and refuse a ledger in another currency
-- ---------------------------------------------------------------------------
create or replace function public.prepare_receipt()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  inv record;
  deal_party uuid;
  deal_currency text;
  acct_currency text;
  target_currency text;
begin
  if new.invoice_id is not null then
    select i.deal_id, i.currency into inv from public.invoices i where i.id = new.invoice_id;
    if not found then
      raise exception 'Invoice not found';
    end if;
    if new.deal_id is null then
      new.deal_id := inv.deal_id;
    end if;
    target_currency := inv.currency;
  end if;

  if new.deal_id is not null then
    select d.party_id, d.currency into deal_party, deal_currency from public.deals d where d.id = new.deal_id;
    if deal_party is null then
      raise exception 'Deal not found';
    end if;
    if new.party_id is null then
      new.party_id := deal_party;
    end if;
    if target_currency is null then
      target_currency := deal_currency;
    end if;
  end if;

  if target_currency is null or target_currency = new.currency then
    new.applied_amount := new.amount;
  elsif new.applied_amount is null then
    raise exception 'Enter the amount in % to apply against the linked record', target_currency;
  end if;

  if new.bank_account_id is not null then
    select a.currency into acct_currency from public.bank_accounts a where a.id = new.bank_account_id;
    if acct_currency is distinct from new.currency then
      raise exception 'The selected ledger is in %, but this receipt is in %', acct_currency, new.currency;
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.prepare_receipt() from public, anon, authenticated;

create trigger receipts_prepare before insert or update on public.receipts
  for each row execute function public.prepare_receipt();

-- ---------------------------------------------------------------------------
-- expense consistency: paid needs a date; ledger currency must match
-- ---------------------------------------------------------------------------
create or replace function public.prepare_expense()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  acct_currency text;
begin
  if new.status = 'paid' and new.paid_on is null then
    new.paid_on := new.spent_on;
  end if;
  if new.status = 'unpaid' then
    new.paid_on := null;
  end if;
  if new.bank_account_id is not null then
    select a.currency into acct_currency from public.bank_accounts a where a.id = new.bank_account_id;
    if acct_currency is distinct from new.currency then
      raise exception 'The selected ledger is in %, but this expense is in %', acct_currency, new.currency;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.prepare_expense() from public, anon, authenticated;

create trigger expenses_prepare before insert or update on public.expenses
  for each row execute function public.prepare_expense();

-- ---------------------------------------------------------------------------
-- keep invoices.status in step with receipts:
--   issued -> paid when receipts cover the total
--   paid   -> issued when a receipt is removed and they no longer do
-- Invoices marked paid by hand with no receipts are never touched.
-- ---------------------------------------------------------------------------
create or replace function public.sync_invoice_payment_status()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  inv_id uuid;
  inv_total numeric;
  received numeric;
begin
  for inv_id in
    select distinct x from unnest(array[
      case when tg_op <> 'INSERT' then old.invoice_id end,
      case when tg_op <> 'DELETE' then new.invoice_id end
    ]) as x where x is not null
  loop
    select i.total into inv_total from public.invoices i where i.id = inv_id;
    select coalesce(sum(r.applied_amount), 0) into received from public.receipts r where r.invoice_id = inv_id;
    if inv_total > 0 and received >= inv_total then
      update public.invoices set status = 'paid' where id = inv_id and status = 'issued';
    elsif received < inv_total then
      update public.invoices set status = 'issued' where id = inv_id and status = 'paid';
    end if;
  end loop;
  return null;
end;
$$;

revoke execute on function public.sync_invoice_payment_status() from public, anon, authenticated;

create trigger receipts_sync_invoice after insert or update or delete on public.receipts
  for each row execute function public.sync_invoice_payment_status();

-- ---------------------------------------------------------------------------
-- balance views (security_invoker: the caller's RLS applies)
-- ---------------------------------------------------------------------------
create view public.invoice_balances with (security_invoker = true) as
select
  i.id as invoice_id,
  i.total,
  coalesce(sum(r.applied_amount), 0)::numeric(14,2) as received,
  (i.total - coalesce(sum(r.applied_amount), 0))::numeric(14,2) as balance,
  count(r.id)::int as receipt_count,
  max(r.received_on) as last_received_on
from public.invoices i
left join public.receipts r on r.invoice_id = i.id
group by i.id;

create view public.deal_balances with (security_invoker = true) as
select
  d.id as deal_id,
  coalesce((select sum(i.total) from public.invoices i where i.deal_id = d.id and i.status in ('issued', 'paid')), 0)::numeric(14,2) as invoiced,
  coalesce((select sum(r.applied_amount) from public.receipts r where r.deal_id = d.id), 0)::numeric(14,2) as received,
  coalesce((select sum(e.amount) from public.expenses e where e.deal_id = d.id and e.currency = d.currency), 0)::numeric(14,2) as costs,
  (select count(*) from public.expenses e where e.deal_id = d.id and e.currency <> d.currency)::int as costs_other_currency
from public.deals d;

create view public.bank_account_balances with (security_invoker = true) as
select
  a.id as bank_account_id,
  (
    a.opening_balance
    + coalesce((select sum(r.amount) from public.receipts r where r.bank_account_id = a.id), 0)
    - coalesce((select sum(e.amount) from public.expenses e where e.bank_account_id = a.id and e.status = 'paid'), 0)
    - coalesce((select sum(t.amount_out) from public.account_transfers t where t.from_account_id = a.id), 0)
    + coalesce((select sum(t.amount_in) from public.account_transfers t where t.to_account_id = a.id), 0)
  )::numeric(14,2) as balance
from public.bank_accounts a;

-- ---------------------------------------------------------------------------
-- Row Level Security: admin only
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'parties', 'bank_accounts', 'deals', 'expense_categories', 'receipts', 'expenses', 'account_transfers'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "admin full access" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t
    );
    execute format(
      'create policy "anon denied" on public.%I for all to anon using (false) with check (false)',
      t
    );
  end loop;
end;
$$;

revoke all on public.invoice_balances, public.deal_balances, public.bank_account_balances from anon;
grant select on public.invoice_balances, public.deal_balances, public.bank_account_balances to authenticated;
