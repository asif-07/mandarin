-- create_lead / create_traveller / create_b2b_group: add transit_location
-- Optional transit location for packages that include transit (additive; existing rows stay null)
alter table public.leads add column if not exists transit_location text check (transit_location is null or transit_location in ('Shenzhen Bay Border', 'Guangzhou', 'Foshan'));
alter table public.travellers add column if not exists transit_location text check (transit_location is null or transit_location in ('Shenzhen Bay Border', 'Guangzhou', 'Foshan'));
alter table public.travel_groups add column if not exists transit_location text check (transit_location is null or transit_location in ('Shenzhen Bay Border', 'Guangzhou', 'Foshan'));


create or replace function public.create_lead(p_year int, p_lead jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare n int; new_id uuid;
begin
  n := public.next_counter('lead_' || p_year::text);
  insert into public.leads (
    lead_ref, customer_id, full_name, phone, email, country, city, entry_city,
    enquiry_type, package_tier, hotel_name, hotel_stars, transit_location, source, status, pax_count, travel_month, canton_phase,
    quoted_amount, quoted_currency, assigned_to, next_followup_date, notes, created_by
  ) values (
    'LD-' || p_year::text || '-' || lpad(n::text, 4, '0'),
    nullif(p_lead->>'customer_id', '')::uuid, p_lead->>'full_name', p_lead->>'phone', p_lead->>'email', p_lead->>'country', p_lead->>'city', p_lead->>'entry_city',
    p_lead->>'enquiry_type', nullif(p_lead->>'package_tier', ''), nullif(p_lead->>'hotel_name', ''), nullif(p_lead->>'hotel_stars', '')::smallint, nullif(p_lead->>'transit_location', ''), p_lead->>'source', coalesce(p_lead->>'status', 'new'),
    coalesce((p_lead->>'pax_count')::int, 1), p_lead->>'travel_month', p_lead->>'canton_phase',
    (p_lead->>'quoted_amount')::numeric, coalesce(p_lead->>'quoted_currency', 'USD'), nullif(p_lead->>'assigned_to', '')::uuid,
    (p_lead->>'next_followup_date')::date, p_lead->>'notes', auth.uid()
  ) returning id into new_id;
  return new_id;
end; $$;

-- create_traveller: add hotel_stars
create or replace function public.create_traveller(p_year int, p_traveller jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare n int; new_id uuid;
begin
  n := public.next_counter('traveller_' || p_year::text);
  insert into public.travellers (
    traveller_ref, customer_id, lead_id, invoice_id, full_name, phone, email,
    passport_number, nationality, travel_start_date, travel_end_date,
    travel_group_id, visa_reference, status, package_tier, hotel_name, hotel_stars, transit_location, notes, created_by
  ) values (
    'TR-' || p_year::text || '-' || lpad(n::text, 4, '0'),
    nullif(p_traveller->>'customer_id', '')::uuid, nullif(p_traveller->>'lead_id', '')::uuid, nullif(p_traveller->>'invoice_id', '')::uuid,
    p_traveller->>'full_name', p_traveller->>'phone', p_traveller->>'email', p_traveller->>'passport_number', p_traveller->>'nationality',
    (p_traveller->>'travel_start_date')::date, (p_traveller->>'travel_end_date')::date,
    nullif(p_traveller->>'travel_group_id', '')::uuid, p_traveller->>'visa_reference', coalesce(p_traveller->>'status', 'documents_pending'),
    nullif(p_traveller->>'package_tier', ''), nullif(p_traveller->>'hotel_name', ''), nullif(p_traveller->>'hotel_stars', '')::smallint, nullif(p_traveller->>'transit_location', ''), p_traveller->>'notes', auth.uid()
  ) returning id into new_id;
  return new_id;
end; $$;

-- create_b2b_group: add hotel_stars
create or replace function public.create_b2b_group(p jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare d date; code text; new_id uuid;
begin
  d := (p->>'travel_date')::date;
  perform pg_advisory_xact_lock(hashtext('travel_groups:' || d::text));
  code := public.next_group_code(d);
  insert into public.travel_groups (
    travel_date, travel_end_date, group_code, reference_prefix, source, partner_code, partner_reference,
    pax_expected, label, guide_name, notes, entry_port, exit_port, package_tier, hotel_name, hotel_stars, transit_location, created_by
  ) values (
    d, (p->>'travel_end_date')::date, code, coalesce(nullif(p->>'reference_prefix', ''), 'MR144'), 'b2b', upper(p->>'partner_code'), p->>'partner_reference',
    (p->>'pax_expected')::int, nullif(p->>'label', ''), nullif(p->>'guide_name', ''), nullif(p->>'notes', ''), nullif(p->>'entry_port', ''), nullif(p->>'exit_port', ''),
    nullif(p->>'package_tier', ''), nullif(p->>'hotel_name', ''), nullif(p->>'hotel_stars', '')::smallint, nullif(p->>'transit_location', ''), auth.uid()
  ) returning id into new_id;
  return jsonb_build_object('id', new_id, 'group_code', code);
end; $$;
