-- New package "Visa + PAR + Hotel + Transport" with a hotel star rating (3/4/5)
alter table public.leads drop constraint if exists leads_package_tier_check;
alter table public.leads add constraint leads_package_tier_check
  check (package_tier is null or package_tier in ('visa_only', 'visa_par', 'visa_par_transit', 'visa_transit', 'visa_transit_hotel', 'visa_par_hotel_transport'));
alter table public.travellers drop constraint if exists travellers_package_tier_check;
alter table public.travellers add constraint travellers_package_tier_check
  check (package_tier is null or package_tier in ('visa_only', 'visa_par', 'visa_par_transit', 'visa_transit', 'visa_transit_hotel', 'visa_par_hotel_transport'));
alter table public.travel_groups drop constraint if exists travel_groups_package_tier_check;
alter table public.travel_groups add constraint travel_groups_package_tier_check
  check (package_tier is null or package_tier in ('visa_only', 'visa_par', 'visa_par_transit', 'visa_transit', 'visa_transit_hotel', 'visa_par_hotel_transport'));

alter table public.leads add column if not exists hotel_stars smallint check (hotel_stars is null or hotel_stars in (3, 4, 5));
alter table public.travellers add column if not exists hotel_stars smallint check (hotel_stars is null or hotel_stars in (3, 4, 5));
alter table public.travel_groups add column if not exists hotel_stars smallint check (hotel_stars is null or hotel_stars in (3, 4, 5));

-- create_lead: add hotel_stars
create or replace function public.create_lead(p_year int, p_lead jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare n int; new_id uuid;
begin
  n := public.next_counter('lead_' || p_year::text);
  insert into public.leads (
    lead_ref, customer_id, full_name, phone, email, country, city, entry_city,
    enquiry_type, package_tier, hotel_name, hotel_stars, source, status, pax_count, travel_month, canton_phase,
    quoted_amount, quoted_currency, assigned_to, next_followup_date, notes, created_by
  ) values (
    'LD-' || p_year::text || '-' || lpad(n::text, 4, '0'),
    nullif(p_lead->>'customer_id', '')::uuid, p_lead->>'full_name', p_lead->>'phone', p_lead->>'email', p_lead->>'country', p_lead->>'city', p_lead->>'entry_city',
    p_lead->>'enquiry_type', nullif(p_lead->>'package_tier', ''), nullif(p_lead->>'hotel_name', ''), nullif(p_lead->>'hotel_stars', '')::smallint, p_lead->>'source', coalesce(p_lead->>'status', 'new'),
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
    travel_group_id, visa_reference, status, package_tier, hotel_name, hotel_stars, notes, created_by
  ) values (
    'TR-' || p_year::text || '-' || lpad(n::text, 4, '0'),
    nullif(p_traveller->>'customer_id', '')::uuid, nullif(p_traveller->>'lead_id', '')::uuid, nullif(p_traveller->>'invoice_id', '')::uuid,
    p_traveller->>'full_name', p_traveller->>'phone', p_traveller->>'email', p_traveller->>'passport_number', p_traveller->>'nationality',
    (p_traveller->>'travel_start_date')::date, (p_traveller->>'travel_end_date')::date,
    nullif(p_traveller->>'travel_group_id', '')::uuid, p_traveller->>'visa_reference', coalesce(p_traveller->>'status', 'documents_pending'),
    nullif(p_traveller->>'package_tier', ''), nullif(p_traveller->>'hotel_name', ''), nullif(p_traveller->>'hotel_stars', '')::smallint, p_traveller->>'notes', auth.uid()
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
    pax_expected, label, guide_name, notes, entry_port, exit_port, package_tier, hotel_name, hotel_stars, created_by
  ) values (
    d, (p->>'travel_end_date')::date, code, coalesce(nullif(p->>'reference_prefix', ''), 'MR144'), 'b2b', upper(p->>'partner_code'), p->>'partner_reference',
    (p->>'pax_expected')::int, nullif(p->>'label', ''), nullif(p->>'guide_name', ''), nullif(p->>'notes', ''), nullif(p->>'entry_port', ''), nullif(p->>'exit_port', ''),
    nullif(p->>'package_tier', ''), nullif(p->>'hotel_name', ''), nullif(p->>'hotel_stars', '')::smallint, auth.uid()
  ) returning id into new_id;
  return jsonb_build_object('id', new_id, 'group_code', code);
end; $$;
