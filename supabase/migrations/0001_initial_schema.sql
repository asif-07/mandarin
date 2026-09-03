-- Mandarin Roots operations platform: core schema
-- All timestamps are stored in UTC (timestamptz); the UI renders them in Asia/Dubai.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles (mirrors auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null,
  display_name text not null,
  role text not null default 'sales' check (role in ('admin', 'sales', 'document')),
  created_at timestamptz default now()
);

-- Auto-create a profile row whenever an auth user is created (seed script passes
-- username / display_name / role in user metadata).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', initcap(split_part(new.email, '@', 1))),
    coalesce(new.raw_user_meta_data->>'role', 'sales')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- customers (shared by CRM and Travel)
-- ---------------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text,
  nationality text,
  passport_number text,
  company text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- leads (CRM)
-- ---------------------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  lead_ref text unique not null,                       -- LD-2026-0001
  customer_id uuid references public.customers(id) on delete set null,
  full_name text not null,
  phone text not null,
  email text,
  country text,                                        -- UAE | India | Saudi Arabia | Qatar | Oman | Kuwait | Bahrain | Other
  city text,
  entry_city text,                                     -- intended China entry city (visa enquiries)
  enquiry_type text not null check (enquiry_type in ('144hr_visa', 'canton_fair_package', 'china_business_visa', 'group_tour', 'other')),
  source text not null check (source in ('whatsapp', 'instagram', 'facebook', 'referral', 'walk_in', 'website', 'linkedin', 'other')),
  status text not null default 'new' check (status in ('new', 'contacted', 'quoted', 'negotiating', 'won', 'lost', 'on_hold')),
  lost_reason text,
  pax_count int default 1,
  travel_month text,                                   -- free text, e.g. "Oct 2026"
  canton_phase text check (canton_phase is null or canton_phase in ('phase_1', 'phase_2', 'phase_3', 'n/a')),
  quoted_amount numeric(12,2),
  quoted_currency text default 'USD',
  assigned_to uuid references public.profiles(id),
  next_followup_date date,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index leads_status_idx on public.leads (status);
create index leads_next_followup_idx on public.leads (next_followup_date);
create index leads_created_at_idx on public.leads (created_at desc);
create index leads_assigned_to_idx on public.leads (assigned_to);

-- ---------------------------------------------------------------------------
-- lead activity log
-- ---------------------------------------------------------------------------
create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  activity_type text not null check (activity_type in ('note', 'call', 'whatsapp', 'email', 'meeting', 'status_change')),
  body text,
  old_status text,
  new_status text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create index lead_activities_lead_idx on public.lead_activities (lead_id, created_at desc);

-- ---------------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique not null,                 -- MR-2026-179
  sequence_number int not null,                        -- 179
  issue_date date not null,
  due_date_label text default 'On Receipt',
  currency text not null default 'USD' check (currency in ('USD', 'AED', 'CNY', 'INR')),
  bill_to_name text not null,
  bill_to_phone text,
  bill_to_email text,
  bill_to_address text,
  visa_reference text,
  subtotal numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  amount_in_words text not null,
  terms text,
  status text not null default 'issued' check (status in ('draft', 'issued', 'paid', 'cancelled')),
  lead_id uuid references public.leads(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  pdf_path text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index invoices_sequence_idx on public.invoices (sequence_number desc);
create index invoices_status_idx on public.invoices (status);
create index invoices_issue_date_idx on public.invoices (issue_date desc);
create index invoices_lead_idx on public.invoices (lead_id);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete cascade,
  position int not null,
  title text not null,
  description text,
  reference text,
  quantity numeric(10,2) not null default 1,
  rate numeric(12,2) not null,
  amount numeric(12,2) not null
);

create index invoice_items_invoice_idx on public.invoice_items (invoice_id, position);

-- ---------------------------------------------------------------------------
-- counters for sequential numbering
-- ---------------------------------------------------------------------------
create table public.counters (
  key text primary key,                                -- 'invoice_2026', 'lead_2026', 'traveller_2026'
  current_value int not null
);

insert into public.counters values ('invoice_2026', 178);   -- next invoice issued is 179
insert into public.counters values ('lead_2026', 0);
insert into public.counters values ('traveller_2026', 0);

-- Atomically increment and return a counter. The row-level lock taken by the
-- UPDATE guarantees two concurrent callers never receive the same value.
create or replace function public.next_counter(counter_key text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v int;
begin
  insert into public.counters (key, current_value)
  values (counter_key, 1)
  on conflict (key) do update set current_value = public.counters.current_value + 1
  returning current_value into v;
  return v;
end;
$$;

revoke all on function public.next_counter(text) from public;
grant execute on function public.next_counter(text) to authenticated;

-- ---------------------------------------------------------------------------
-- travel groups
-- ---------------------------------------------------------------------------
create table public.travel_groups (
  id uuid primary key default gen_random_uuid(),
  group_code text not null,                            -- G01 ... G20
  travel_date date not null,
  label text,
  guide_name text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  unique (travel_date, group_code)
);

create index travel_groups_date_idx on public.travel_groups (travel_date desc);

-- ---------------------------------------------------------------------------
-- travellers
-- ---------------------------------------------------------------------------
create table public.travellers (
  id uuid primary key default gen_random_uuid(),
  traveller_ref text unique not null,                  -- TR-2026-0001
  customer_id uuid references public.customers(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  full_name text not null,
  phone text,
  email text,
  passport_number text,
  nationality text,
  travel_start_date date not null,
  travel_end_date date not null,
  travel_group_id uuid references public.travel_groups(id) on delete set null,
  visa_reference text,
  status text not null default 'documents_pending' check (status in ('documents_pending', 'documents_complete', 'visa_applied', 'visa_approved', 'travelled', 'cancelled')),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index travellers_start_date_idx on public.travellers (travel_start_date);
create index travellers_group_idx on public.travellers (travel_group_id);
create index travellers_status_idx on public.travellers (status);
create index travellers_lead_idx on public.travellers (lead_id);

-- ---------------------------------------------------------------------------
-- uploaded documents (soft-deleted on replace for an audit trail)
-- ---------------------------------------------------------------------------
create table public.traveller_documents (
  id uuid primary key default gen_random_uuid(),
  traveller_id uuid references public.travellers(id) on delete cascade,
  doc_type text not null check (doc_type in ('par', 'passport', 'flight_ticket', 'hotel_booking', 'other')),
  file_name text not null,
  storage_path text not null,
  mime_type text not null,
  file_size int,
  merge_order int not null default 99,
  uploaded_by uuid references public.profiles(id),
  uploaded_at timestamptz default now(),
  deleted_at timestamptz,                              -- set when replaced or removed; row is never hard-deleted
  deleted_by uuid references public.profiles(id)
);

create index traveller_documents_traveller_idx on public.traveller_documents (traveller_id, merge_order) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- compiled travel packs
-- ---------------------------------------------------------------------------
create table public.travel_packs (
  id uuid primary key default gen_random_uuid(),
  traveller_id uuid references public.travellers(id) on delete cascade,
  storage_path text not null,
  page_count int,
  included_doc_ids uuid[],
  generated_by uuid references public.profiles(id),
  generated_at timestamptz default now()
);

create index travel_packs_traveller_idx on public.travel_packs (traveller_id, generated_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger customers_set_updated_at before update on public.customers
  for each row execute function public.set_updated_at();
create trigger leads_set_updated_at before update on public.leads
  for each row execute function public.set_updated_at();
create trigger invoices_set_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();
create trigger travellers_set_updated_at before update on public.travellers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: v1 is fully shared access for any signed-in user.
-- Roles live on profiles.role so per-role policies can be added later
-- without changing the schema.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'customers', 'leads', 'lead_activities', 'invoices', 'invoice_items',
    'counters', 'travel_groups', 'travellers', 'traveller_documents', 'travel_packs'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "authenticated full access" on public.%I for all to authenticated using (true) with check (true)',
      t
    );
    execute format(
      'create policy "anon denied" on public.%I for all to anon using (false) with check (false)',
      t
    );
  end loop;
end;
$$;
