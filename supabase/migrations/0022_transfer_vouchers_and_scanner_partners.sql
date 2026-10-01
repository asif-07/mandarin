-- Transfer vouchers with a unique QR token, the authorised ground partners who
-- verify and redeem them from the mobile web scanner, and a private bucket for
-- the transport tickets those partners upload.
--
-- CRM staff (authenticated) have full access. The scanner runs server-side with
-- the service role after checking the partner's access key, so partners never
-- receive database credentials and an unauthorised scan exposes nothing.

create table public.scanner_partners (
  id uuid primary key default gen_random_uuid(),
  code text not null,                       -- short label, e.g. HKT
  name text not null,                       -- e.g. Hong Kong Transfers Ltd
  access_key_hash text not null unique,     -- sha256 of the key shown once at creation
  active boolean not null default true,
  last_seen_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index scanner_partners_code_key on public.scanner_partners (upper(code));

create table public.transfer_vouchers (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.travel_groups(id) on delete cascade,
  group_service_id uuid references public.group_services(id) on delete set null,
  voucher_no text not null unique,          -- MR144-RCHC-OCT12-OCT17-G01-TV01
  token text not null unique,               -- random, printed in the QR; carries no voucher data
  status text not null default 'active' check (status in ('active', 'redeemed', 'cancelled')),
  from_place text not null,
  to_place text not null,
  transfer_date date not null,
  pax integer not null check (pax > 0),
  transfer_mode text check (transfer_mode is null or transfer_mode in ('private_chauffeur', 'seat_in_coach', 'private_bus', 'other')),
  notes text,
  issued_by uuid references public.profiles(id),
  issued_at timestamptz not null default now(),
  ticket_path text,
  ticket_file_name text,
  ticket_mime text,
  ticket_uploaded_at timestamptz,
  ticket_partner_id uuid references public.scanner_partners(id) on delete set null,
  redeemed_at timestamptz,
  redeemed_partner_id uuid references public.scanner_partners(id) on delete set null,
  cancelled_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index transfer_vouchers_group_idx on public.transfer_vouchers (group_id);
create index transfer_vouchers_date_idx on public.transfer_vouchers (transfer_date);
create index transfer_vouchers_status_idx on public.transfer_vouchers (status);

create trigger scanner_partners_set_updated_at before update on public.scanner_partners
  for each row execute function public.set_updated_at();
create trigger transfer_vouchers_set_updated_at before update on public.transfer_vouchers
  for each row execute function public.set_updated_at();

alter table public.scanner_partners enable row level security;
create policy "authenticated full access" on public.scanner_partners for all to authenticated using (true) with check (true);
create policy "anon denied" on public.scanner_partners for all to anon using (false) with check (false);

alter table public.transfer_vouchers enable row level security;
create policy "authenticated full access" on public.transfer_vouchers for all to authenticated using (true) with check (true);
create policy "anon denied" on public.transfer_vouchers for all to anon using (false) with check (false);

-- Private bucket for the transport tickets partners upload. Written by the
-- server (service role) from the scanner; readable by CRM staff via signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('transfer-tickets', 'transfer-tickets', false, 15728640, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;
create policy "authenticated read transfer tickets" on storage.objects for select to authenticated using (bucket_id = 'transfer-tickets');
