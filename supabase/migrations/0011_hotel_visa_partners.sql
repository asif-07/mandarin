-- Hotel name for "Visa + Transit + Hotel" packages
alter table public.travellers add column if not exists hotel_name text;
alter table public.leads add column if not exists hotel_name text;

-- Group-level package, and the visa lifecycle: pending -> applied (pack downloaded) -> approved (visa page uploaded)
alter table public.travel_groups
  add column if not exists package_tier text check (package_tier is null or package_tier in ('visa_only', 'visa_transit', 'visa_transit_hotel')),
  add column if not exists hotel_name text,
  add column if not exists visa_status text not null default 'pending' check (visa_status in ('pending', 'applied', 'approved')),
  add column if not exists visa_applied_at timestamptz,
  add column if not exists visa_path text,
  add column if not exists visa_file_name text,
  add column if not exists visa_uploaded_at timestamptz,
  add column if not exists visa_uploaded_by uuid references public.profiles(id);

-- B2B partners (travel-level, not admin-only): code as used in their pack names, display name, logo for cover pages
create table if not exists public.b2b_partners (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text,
  logo_path text,
  logo_file_name text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index if not exists b2b_partners_code_key on public.b2b_partners (upper(code));
create trigger b2b_partners_set_updated_at before update on public.b2b_partners
  for each row execute function public.set_updated_at();
alter table public.b2b_partners enable row level security;
create policy "authenticated full access" on public.b2b_partners for all to authenticated using (true) with check (true);
create policy "anon denied" on public.b2b_partners for all to anon using (false) with check (false);

-- Private bucket for partner logos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('partner-logos', 'partner-logos', false, 5242880, array['image/png', 'image/jpeg'])
on conflict (id) do nothing;
create policy "authenticated read partner logos" on storage.objects for select to authenticated using (bucket_id = 'partner-logos');
create policy "authenticated insert partner logos" on storage.objects for insert to authenticated with check (bucket_id = 'partner-logos');
create policy "authenticated update partner logos" on storage.objects for update to authenticated using (bucket_id = 'partner-logos');
create policy "authenticated delete partner logos" on storage.objects for delete to authenticated using (bucket_id = 'partner-logos');

-- create_lead: add hotel_name
create or replace function public.create_lead(p_year int, p_lead jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare n int; new_id uuid;
begin
  n := public.next_counter('lead_' || p_year::text);
  insert into public.leads (
    lead_ref, customer_id, full_name, phone, email, country, city, entry_city,
    enquiry_type, package_tier, hotel_name, source, status, pax_count, travel_month, canton_phase,
    quoted_amount, quoted_currency, assigned_to, next_followup_date, notes, created_by
  ) values (
    'LD-' || p_year::text || '-' || lpad(n::text, 4, '0'),
    nullif(p_lead->>'customer_id', '')::uuid, p_lead->>'full_name', p_lead->>'phone', p_lead->>'email', p_lead->>'country', p_lead->>'city', p_lead->>'entry_city',
    p_lead->>'enquiry_type', nullif(p_lead->>'package_tier', ''), nullif(p_lead->>'hotel_name', ''), p_lead->>'source', coalesce(p_lead->>'status', 'new'),
    coalesce((p_lead->>'pax_count')::int, 1), p_lead->>'travel_month', p_lead->>'canton_phase',
    (p_lead->>'quoted_amount')::numeric, coalesce(p_lead->>'quoted_currency', 'USD'), nullif(p_lead->>'assigned_to', '')::uuid,
    (p_lead->>'next_followup_date')::date, p_lead->>'notes', auth.uid()
  ) returning id into new_id;
  return new_id;
end; $$;

-- create_traveller: add package_tier and hotel_name (package_tier was silently dropped before)
create or replace function public.create_traveller(p_year int, p_traveller jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare n int; new_id uuid;
begin
  n := public.next_counter('traveller_' || p_year::text);
  insert into public.travellers (
    traveller_ref, customer_id, lead_id, invoice_id, full_name, phone, email,
    passport_number, nationality, travel_start_date, travel_end_date,
    travel_group_id, visa_reference, status, package_tier, hotel_name, notes, created_by
  ) values (
    'TR-' || p_year::text || '-' || lpad(n::text, 4, '0'),
    nullif(p_traveller->>'customer_id', '')::uuid, nullif(p_traveller->>'lead_id', '')::uuid, nullif(p_traveller->>'invoice_id', '')::uuid,
    p_traveller->>'full_name', p_traveller->>'phone', p_traveller->>'email', p_traveller->>'passport_number', p_traveller->>'nationality',
    (p_traveller->>'travel_start_date')::date, (p_traveller->>'travel_end_date')::date,
    nullif(p_traveller->>'travel_group_id', '')::uuid, p_traveller->>'visa_reference', coalesce(p_traveller->>'status', 'documents_pending'),
    nullif(p_traveller->>'package_tier', ''), nullif(p_traveller->>'hotel_name', ''), p_traveller->>'notes', auth.uid()
  ) returning id into new_id;
  return new_id;
end; $$;

-- create_b2b_group: add package_tier and hotel_name
create or replace function public.create_b2b_group(p jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare d date; code text; new_id uuid;
begin
  d := (p->>'travel_date')::date;
  perform pg_advisory_xact_lock(hashtext('travel_groups:' || d::text));
  code := public.next_group_code(d);
  insert into public.travel_groups (
    travel_date, travel_end_date, group_code, reference_prefix, source, partner_code, partner_reference,
    pax_expected, label, guide_name, notes, entry_port, exit_port, package_tier, hotel_name, created_by
  ) values (
    d, (p->>'travel_end_date')::date, code, coalesce(nullif(p->>'reference_prefix', ''), 'MR144'), 'b2b', upper(p->>'partner_code'), p->>'partner_reference',
    (p->>'pax_expected')::int, nullif(p->>'label', ''), nullif(p->>'guide_name', ''), nullif(p->>'notes', ''), nullif(p->>'entry_port', ''), nullif(p->>'exit_port', ''),
    nullif(p->>'package_tier', ''), nullif(p->>'hotel_name', ''), auth.uid()
  ) returning id into new_id;
  return jsonb_build_object('id', new_id, 'group_code', code);
end; $$;
