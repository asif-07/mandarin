-- Product / Service master and per-group service details.
--
-- services: the master list every group picks from (Airport Transfer, Visa,
-- Hotel Booking, ...). `kind` decides which detail fields a group asks for:
-- airport_transfer -> from, to, date, pax, transfer mode; general -> notes.
--
-- group_services: one row per service attached to a group, with the details
-- entered once at group level. Invoices pull the service name and summary
-- from here; the transfer voucher prints a single airport_transfer row.
create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'general' check (kind in ('airport_transfer', 'general')),
  description text,
  default_rate numeric(14,2) check (default_rate is null or default_rate >= 0),
  currency text check (currency is null or currency in ('USD', 'AED', 'CNY', 'INR')),
  active boolean not null default true,
  sort integer not null default 100,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index services_name_key on public.services (lower(name));

create table public.group_services (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.travel_groups(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  service_name text not null,                   -- snapshot of the master name when attached
  kind text not null default 'general' check (kind in ('airport_transfer', 'general')),
  from_place text,
  to_place text,
  service_date date,
  pax integer check (pax is null or pax > 0),
  transfer_mode text check (transfer_mode is null or transfer_mode in ('private_chauffeur', 'seat_in_coach', 'private_bus', 'other')),
  notes text,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  rate numeric(14,2) check (rate is null or rate >= 0),
  currency text check (currency is null or currency in ('USD', 'AED', 'CNY', 'INR')),
  position integer not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index group_services_group_idx on public.group_services (group_id, position);

create trigger services_set_updated_at before update on public.services
  for each row execute function public.set_updated_at();
create trigger group_services_set_updated_at before update on public.group_services
  for each row execute function public.set_updated_at();

alter table public.services enable row level security;
create policy "authenticated full access" on public.services for all to authenticated using (true) with check (true);
create policy "anon denied" on public.services for all to anon using (false) with check (false);

alter table public.group_services enable row level security;
create policy "authenticated full access" on public.group_services for all to authenticated using (true) with check (true);
create policy "anon denied" on public.group_services for all to anon using (false) with check (false);

insert into public.services (name, kind, description, sort) values
  ('Airport Transfer', 'airport_transfer', 'Transfer between airport, border or city. Asks for from, to, date, pax and transfer mode.', 10),
  ('China Visa', 'general', 'Visa application and processing', 20),
  ('PAR', 'general', 'Port arrival registration', 30),
  ('Hotel Booking', 'general', 'Hotel reservation', 40),
  ('Transit', 'general', 'Transit arrangement', 50),
  ('Tour Guide', 'general', 'Guide service for the group', 60)
on conflict do nothing;
