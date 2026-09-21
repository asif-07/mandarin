-- Our own groups get their G-code assigned in the database, under the same
-- per-date advisory lock the B2B upload uses, so two people creating groups
-- for the same day never collide and nobody has to type the code.
create or replace function public.create_travel_group(p jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare d date; code text; new_id uuid;
begin
  d := (p->>'travel_date')::date;
  perform pg_advisory_xact_lock(hashtext('travel_groups:' || d::text));
  code := public.next_group_code(d);
  insert into public.travel_groups (
    travel_date, travel_end_date, group_code, reference_prefix, source,
    label, guide_name, notes, entry_port, exit_port, package_tier, hotel_name, hotel_stars, transit_location, created_by
  ) values (
    d, (p->>'travel_end_date')::date, code, coalesce(nullif(p->>'reference_prefix', ''), 'MR144'), 'internal',
    nullif(p->>'label', ''), nullif(p->>'guide_name', ''), nullif(p->>'notes', ''), nullif(p->>'entry_port', ''), nullif(p->>'exit_port', ''),
    nullif(p->>'package_tier', ''), nullif(p->>'hotel_name', ''), nullif(p->>'hotel_stars', '')::smallint, nullif(p->>'transit_location', ''), auth.uid()
  ) returning id into new_id;
  return jsonb_build_object('id', new_id, 'group_code', code);
end; $$;
revoke all on function public.create_travel_group(jsonb) from public, anon;
grant execute on function public.create_travel_group(jsonb) to authenticated;
