-- Hardening from the Supabase security advisor:
--  * pin search_path on the trigger function
--  * make sure anon can never call the RPC functions, and nobody can call the
--    auth trigger function through PostgREST

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.next_counter(text) from anon;
revoke execute on function public.create_invoice(int, jsonb, jsonb) from anon;
revoke execute on function public.update_invoice(uuid, jsonb, jsonb) from anon;
revoke execute on function public.create_lead(int, jsonb) from anon;
revoke execute on function public.create_traveller(int, jsonb) from anon;
