-- One application can hold several passengers: a customer adds co-passengers
-- to their own application, a travel agent bulk-uploads a whole group. The
-- application owns the private link token, the contact details and the trip
-- dates; each passenger stays an ordinary traveller row linked to it.
create table if not exists public.portal_applications (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  kind text not null default 'b2c' check (kind in ('b2c', 'b2b')),
  contact_name text not null,
  contact_phone text,
  contact_email text,
  agency_name text,                            -- b2b: the agency, no partner code asked
  nationality text,
  travel_start_date date not null,
  travel_end_date date not null,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'reviewed')),
  submitted_at timestamptz,
  ready boolean not null default false,        -- every passenger has PAR + hotel
  notes text,
  travel_group_id uuid references public.travel_groups(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now(),
  last_seen_at timestamptz
);
create index if not exists portal_applications_status_idx on public.portal_applications (status, submitted_at desc);
create trigger portal_applications_set_updated_at before update on public.portal_applications for each row execute function public.set_updated_at();
alter table public.portal_applications enable row level security;
create policy "authenticated full access" on public.portal_applications for all to authenticated using (true) with check (true);
create policy "anon denied" on public.portal_applications for all to anon using (false) with check (false);

alter table public.travellers add column if not exists portal_application_id uuid references public.portal_applications(id) on delete set null;
create index if not exists travellers_portal_application_idx on public.travellers (portal_application_id);

-- Backfill: every existing single-traveller application becomes an application of one.
insert into public.portal_applications (token, kind, contact_name, contact_phone, contact_email, nationality, travel_start_date, travel_end_date, status, submitted_at, ready, created_at)
select t.portal_token, 'b2c', t.full_name, t.phone, t.email, t.nationality, t.travel_start_date, t.travel_end_date, coalesce(t.portal_status, 'draft'), t.portal_submitted_at, t.portal_ready, coalesce(t.created_at, now())
from public.travellers t
where t.source = 'b2c_portal' and t.portal_token is not null and t.portal_application_id is null
on conflict (token) do nothing;
update public.travellers t set portal_application_id = a.id
from public.portal_applications a
where t.portal_token = a.token and t.portal_application_id is null;
