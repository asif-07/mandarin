-- Package options: Visa only / Visa + Transit / Visa + Transit + Hotel (replaces 3/4/5 star)
alter table public.leads drop constraint if exists leads_package_tier_check;
update public.leads set package_tier = 'visa_transit_hotel' where package_tier in ('3_star', '4_star', '5_star');
alter table public.leads add constraint leads_package_tier_check
  check (package_tier is null or package_tier in ('visa_only', 'visa_transit', 'visa_transit_hotel'));

alter table public.travellers drop constraint if exists travellers_package_tier_check;
update public.travellers set package_tier = 'visa_transit_hotel' where package_tier in ('3_star', '4_star', '5_star');
alter table public.travellers add constraint travellers_package_tier_check
  check (package_tier is null or package_tier in ('visa_only', 'visa_transit', 'visa_transit_hotel'));

-- B2B groups: a partner sends a compiled pack named like MR144-EDPT-OCT15-OCT20-100PX-G01.
-- We file it under the next free group code on that date and keep their original reference.
alter table public.travel_groups
  add column if not exists source text not null default 'internal' check (source in ('internal', 'b2b')),
  add column if not exists partner_code text,
  add column if not exists partner_reference text,
  add column if not exists pax_expected int check (pax_expected is null or pax_expected >= 0),
  add column if not exists pack_path text,
  add column if not exists pack_file_name text,
  add column if not exists pack_uploaded_at timestamptz,
  add column if not exists pack_uploaded_by uuid references public.profiles(id);

create index if not exists travel_groups_partner_idx on public.travel_groups (partner_code) where partner_code is not null;

-- Next free G-code on a date: one more than the highest existing (G01, G02 -> G03).
create or replace function public.next_group_code(p_date date)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select 'G' || lpad((coalesce(max(substring(group_code from 2)::int), 0) + 1)::text, 2, '0')
  from public.travel_groups
  where travel_date = p_date and group_code ~ '^G[0-9]+$';
$$;

-- Create a B2B group with an atomically assigned code (advisory lock per date).
create or replace function public.create_b2b_group(p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  d date;
  code text;
  new_id uuid;
begin
  d := (p->>'travel_date')::date;
  perform pg_advisory_xact_lock(hashtext('travel_groups:' || d::text));
  code := public.next_group_code(d);
  insert into public.travel_groups (
    travel_date, travel_end_date, group_code, reference_prefix, source, partner_code, partner_reference,
    pax_expected, label, guide_name, notes, entry_port, exit_port, created_by
  ) values (
    d,
    (p->>'travel_end_date')::date,
    code,
    coalesce(nullif(p->>'reference_prefix', ''), 'MR144'),
    'b2b',
    upper(p->>'partner_code'),
    p->>'partner_reference',
    (p->>'pax_expected')::int,
    nullif(p->>'label', ''),
    nullif(p->>'guide_name', ''),
    nullif(p->>'notes', ''),
    nullif(p->>'entry_port', ''),
    nullif(p->>'exit_port', ''),
    auth.uid()
  )
  returning id into new_id;
  return jsonb_build_object('id', new_id, 'group_code', code);
end;
$$;

revoke all on function public.next_group_code(date) from public, anon;
grant execute on function public.next_group_code(date) to authenticated;
revoke all on function public.create_b2b_group(jsonb) from public, anon;
grant execute on function public.create_b2b_group(jsonb) to authenticated;
