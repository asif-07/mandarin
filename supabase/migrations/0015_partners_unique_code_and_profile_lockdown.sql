-- 1. b2b_partners: the upsert in the app targets (code); ON CONFLICT needs a plain unique constraint, the expression index on upper(code) does not qualify, so partner auto-creation and logo saving were failing silently.
update public.b2b_partners set code = upper(code) where code <> upper(code);
alter table public.b2b_partners add constraint b2b_partners_code_unique unique (code);
-- Backfill partners already referenced by groups.
insert into public.b2b_partners (code)
select distinct upper(partner_code) from public.travel_groups where source = 'b2b' and partner_code is not null
on conflict (code) do nothing;

-- 2. profiles: any signed-in user could update any profile, including their own role, which bypassed every admin check. Read for all; update only your own row and never the role or username.
drop policy if exists "authenticated full access" on public.profiles;
create policy "authenticated read profiles" on public.profiles for select to authenticated using (true);
create policy "update own profile, role fixed" on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()) and username = (select p.username from public.profiles p where p.id = auth.uid()));

-- 3. counters: only written through next_counter() (security definer); direct writes could reset invoice numbering.
drop policy if exists "authenticated full access" on public.counters;
create policy "authenticated read counters" on public.counters for select to authenticated using (true);
