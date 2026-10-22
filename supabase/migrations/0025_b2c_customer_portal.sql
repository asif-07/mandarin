-- B2C customer portal: customers open a public link, enter their trip dates,
-- upload passport (read by OCR in the browser), photo, PAN card, address and
-- optionally PAR / flight / hotel, then submit. Each applicant is an ordinary
-- traveller row (source = 'b2c_portal') reached through a random token, so
-- the CRM groups them like any other traveller and the travel pack / group
-- bundle code works unchanged.

alter table public.travellers
  add column if not exists source text not null default 'internal' check (source in ('internal', 'b2c_portal')),
  add column if not exists portal_token text unique,
  add column if not exists portal_status text check (portal_status in ('draft', 'submitted', 'reviewed')),
  add column if not exists portal_submitted_at timestamptz,
  add column if not exists portal_ready boolean not null default false,  -- has PAR + hotel: can apply directly
  add column if not exists portal_last_seen_at timestamptz,
  add column if not exists address text,
  add column if not exists pan_number text,
  add column if not exists date_of_birth date,
  add column if not exists sex text check (sex in ('M', 'F', 'X')),
  add column if not exists passport_expiry date,
  add column if not exists passport_ocr jsonb;

create index if not exists travellers_portal_idx on public.travellers (source, portal_status) where source = 'b2c_portal';

-- Identity documents uploaded through the portal (passport photo, PAN card).
alter table public.traveller_documents drop constraint if exists traveller_documents_doc_type_check;
alter table public.traveller_documents add constraint traveller_documents_doc_type_check
  check (doc_type in ('par', 'passport', 'flight_ticket', 'hotel_booking', 'photo', 'pan_card', 'other'));

-- create_traveller: add the identity fields and the portal columns
create or replace function public.create_traveller(p_year int, p_traveller jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare n int; new_id uuid;
begin
  n := public.next_counter('traveller_' || p_year::text);
  insert into public.travellers (
    traveller_ref, customer_id, lead_id, invoice_id, full_name, phone, email,
    passport_number, nationality, travel_start_date, travel_end_date,
    travel_group_id, visa_reference, status, package_tier, hotel_name, hotel_stars, transit_location, notes, created_by,
    address, pan_number, date_of_birth, sex, passport_expiry, source, portal_token, portal_status
  ) values (
    'TR-' || p_year::text || '-' || lpad(n::text, 4, '0'),
    nullif(p_traveller->>'customer_id', '')::uuid, nullif(p_traveller->>'lead_id', '')::uuid, nullif(p_traveller->>'invoice_id', '')::uuid,
    p_traveller->>'full_name', p_traveller->>'phone', p_traveller->>'email', p_traveller->>'passport_number', p_traveller->>'nationality',
    (p_traveller->>'travel_start_date')::date, (p_traveller->>'travel_end_date')::date,
    nullif(p_traveller->>'travel_group_id', '')::uuid, p_traveller->>'visa_reference', coalesce(p_traveller->>'status', 'documents_pending'),
    nullif(p_traveller->>'package_tier', ''), nullif(p_traveller->>'hotel_name', ''), nullif(p_traveller->>'hotel_stars', '')::smallint, nullif(p_traveller->>'transit_location', ''), p_traveller->>'notes', auth.uid(),
    nullif(p_traveller->>'address', ''), nullif(p_traveller->>'pan_number', ''), nullif(p_traveller->>'date_of_birth', '')::date, nullif(p_traveller->>'sex', ''), nullif(p_traveller->>'passport_expiry', '')::date,
    coalesce(nullif(p_traveller->>'source', ''), 'internal'), nullif(p_traveller->>'portal_token', ''), nullif(p_traveller->>'portal_status', '')
  ) returning id into new_id;
  return new_id;
end; $$;

-- The portal runs server-side with the service role (no staff session).
grant execute on function public.create_traveller(int, jsonb) to service_role;
grant execute on function public.next_counter(text) to service_role;
