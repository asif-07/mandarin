-- create_lead() predates the package_tier column, so package leads lost their
-- tier on creation (updates saved it). Include it.
create or replace function public.create_lead(p_year int, p_lead jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  n int;
  new_id uuid;
begin
  n := public.next_counter('lead_' || p_year::text);

  insert into public.leads (
    lead_ref, customer_id, full_name, phone, email, country, city, entry_city,
    enquiry_type, package_tier, source, status, pax_count, travel_month, canton_phase,
    quoted_amount, quoted_currency, assigned_to, next_followup_date, notes, created_by
  ) values (
    'LD-' || p_year::text || '-' || lpad(n::text, 4, '0'),
    nullif(p_lead->>'customer_id', '')::uuid,
    p_lead->>'full_name',
    p_lead->>'phone',
    p_lead->>'email',
    p_lead->>'country',
    p_lead->>'city',
    p_lead->>'entry_city',
    p_lead->>'enquiry_type',
    nullif(p_lead->>'package_tier', ''),
    p_lead->>'source',
    coalesce(p_lead->>'status', 'new'),
    coalesce((p_lead->>'pax_count')::int, 1),
    p_lead->>'travel_month',
    p_lead->>'canton_phase',
    (p_lead->>'quoted_amount')::numeric,
    coalesce(p_lead->>'quoted_currency', 'USD'),
    nullif(p_lead->>'assigned_to', '')::uuid,
    (p_lead->>'next_followup_date')::date,
    p_lead->>'notes',
    auth.uid()
  )
  returning id into new_id;

  return new_id;
end;
$$;
