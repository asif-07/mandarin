-- Two more package options: Visa + PAR, Visa + PAR + Transit
alter table public.leads drop constraint if exists leads_package_tier_check;
alter table public.leads add constraint leads_package_tier_check
  check (package_tier is null or package_tier in ('visa_only', 'visa_par', 'visa_par_transit', 'visa_transit', 'visa_transit_hotel'));
alter table public.travellers drop constraint if exists travellers_package_tier_check;
alter table public.travellers add constraint travellers_package_tier_check
  check (package_tier is null or package_tier in ('visa_only', 'visa_par', 'visa_par_transit', 'visa_transit', 'visa_transit_hotel'));
alter table public.travel_groups drop constraint if exists travel_groups_package_tier_check;
alter table public.travel_groups add constraint travel_groups_package_tier_check
  check (package_tier is null or package_tier in ('visa_only', 'visa_par', 'visa_par_transit', 'visa_transit', 'visa_transit_hotel'));

-- Group-level shared documents: one flight ticket / hotel booking for the whole
-- group, so travellers do not have to upload the same file each. PAR and
-- passport stay per traveller.
create table if not exists public.group_documents (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.travel_groups(id) on delete cascade,
  doc_type text not null check (doc_type in ('flight_ticket', 'hotel_booking', 'other')),
  file_name text not null,
  storage_path text not null,
  mime_type text not null,
  file_size int,
  uploaded_by uuid references public.profiles(id),
  uploaded_at timestamptz default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id)
);
create index if not exists group_documents_group_idx on public.group_documents (group_id) where deleted_at is null;
alter table public.group_documents enable row level security;
create policy "authenticated full access" on public.group_documents for all to authenticated using (true) with check (true);
create policy "anon denied" on public.group_documents for all to anon using (false) with check (false);
