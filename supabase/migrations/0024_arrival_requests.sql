-- Hong Kong group arrival details submitted by travel agents through a public
-- link (no login): partner code, arrival date, airline & flight, arrival time,
-- pax. CTS replies with notes; the agent sees the reply on a tracking page
-- identified only by a random token. Requests can be attached to a group so
-- arrivals on the same day can be grouped together for the airport transfer.
create table if not exists public.arrival_requests (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,                    -- HKA-20261012-7F3K
  token text not null unique,                  -- tracking page token
  partner_code text not null,
  arrival_date date not null,
  airline_flight text not null,
  arrival_time time not null,
  pax integer not null check (pax > 0 and pax <= 999),
  agent_name text,
  agent_phone text,
  agent_notes text,
  status text not null default 'new' check (status in ('new', 'replied', 'confirmed', 'closed')),
  admin_reply text,
  replied_at timestamptz,
  replied_by text,
  group_id uuid references public.travel_groups(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);
create index if not exists arrival_requests_date_idx on public.arrival_requests (arrival_date, arrival_time);
create index if not exists arrival_requests_status_idx on public.arrival_requests (status);
create trigger arrival_requests_set_updated_at before update on public.arrival_requests for each row execute function public.set_updated_at();
alter table public.arrival_requests enable row level security;
create policy "authenticated full access" on public.arrival_requests for all to authenticated using (true) with check (true);
create policy "anon denied" on public.arrival_requests for all to anon using (false) with check (false);
