-- Partners carry contact details (used to fill invoices) and can be attached to our own groups.
alter table public.b2b_partners
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists address text;

-- Group ID includes the partner code whenever a partner is attached, whether we or they compiled the pack.
create or replace function public.travel_group_ref(p_prefix text, p_partner text, p_source text, p_start date, p_end date, p_code text)
returns text language sql stable as $$
  select upper(coalesce(nullif(p_prefix, ''), 'MR144')) || '-'
      || case when nullif(p_partner, '') is not null then upper(p_partner) || '-' else '' end
      || upper(to_char(p_start, 'Mon')) || to_char(p_start, 'DD') || '-'
      || upper(to_char(coalesce(p_end, p_start), 'Mon')) || to_char(coalesce(p_end, p_start), 'DD') || '-'
      || upper(p_code)
$$;
update public.travel_groups
  set group_ref = public.travel_group_ref(reference_prefix, partner_code, source, travel_date, travel_end_date, group_code);

-- Our own groups may name a partner (the client we compile for); source stays 'internal'.
create or replace function public.create_travel_group(p jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare d date; code text; new_id uuid;
begin
  d := (p->>'travel_date')::date;
  perform pg_advisory_xact_lock(hashtext('travel_groups:' || d::text));
  code := public.next_group_code(d);
  insert into public.travel_groups (
    travel_date, travel_end_date, group_code, reference_prefix, source, partner_code,
    label, guide_name, notes, entry_port, exit_port, package_tier, hotel_name, hotel_stars, transit_location, created_by
  ) values (
    d, (p->>'travel_end_date')::date, code, coalesce(nullif(p->>'reference_prefix', ''), 'MR144'), 'internal', upper(nullif(p->>'partner_code', '')),
    nullif(p->>'label', ''), nullif(p->>'guide_name', ''), nullif(p->>'notes', ''), nullif(p->>'entry_port', ''), nullif(p->>'exit_port', ''),
    nullif(p->>'package_tier', ''), nullif(p->>'hotel_name', ''), nullif(p->>'hotel_stars', '')::smallint, nullif(p->>'transit_location', ''), auth.uid()
  ) returning id into new_id;
  return jsonb_build_object('id', new_id, 'group_code', code);
end; $$;
