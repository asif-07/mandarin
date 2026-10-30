-- Ambro Connects: isolated database, no dependency on Mandarin Roots tables.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 100),
  bio text not null default '' check (char_length(bio) <= 2000),
  city text not null default '' check (char_length(city) <= 100),
  company text not null default '' check (char_length(company) <= 150),
  specialties text[] not null default '{}' check (cardinality(specialties) <= 12),
  languages text[] not null default '{}' check (cardinality(languages) <= 12),
  avatar_url text not null default '' check (char_length(avatar_url) <= 1000),
  cover_url text not null default '' check (char_length(cover_url) <= 1000),
  achievements text[] not null default '{}' check (cardinality(achievements) <= 12),
  portfolio jsonb not null default '[]'::jsonb check (jsonb_typeof(portfolio) = 'array' and jsonb_array_length(portfolio) <= 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.member_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  member_type text not null check (member_type in ('china','global')),
  preferred_plan text not null check (preferred_plan in ('china_yearly','global_monthly','trip_year')),
  moderation_status text not null default 'pending' check (moderation_status in ('pending','approved','rejected','suspended')),
  moderation_reason text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((member_type = 'china' and preferred_plan = 'china_yearly') or (member_type = 'global' and preferred_plan in ('global_monthly','trip_year')))
);
create table public.membership_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan text not null check (plan in ('china_yearly','global_monthly','trip_year')),
  reference text not null check (char_length(reference) between 1 and 200),
  note text not null default '' check (char_length(note) <= 1000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  rejection_reason text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);
create unique index one_pending_membership_request on public.membership_requests(user_id) where status = 'pending';
create index membership_requests_user_idx on public.membership_requests(user_id,created_at desc);
create table public.membership_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_request_id uuid not null unique references public.membership_requests(id),
  plan text not null check (plan in ('china_yearly','global_monthly','trip_year')),
  amount_rmb integer not null,
  starts_at timestamptz not null,
  expires_at timestamptz not null check (expires_at > starts_at),
  approved_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check ((plan = 'china_yearly' and amount_rmb = 1000) or (plan = 'global_monthly' and amount_rmb = 100) or (plan = 'trip_year' and amount_rmb = 0))
);
create index membership_periods_user_idx on public.membership_periods(user_id,expires_at desc);
create unique index trip_benefit_once on public.membership_periods(user_id) where plan = 'trip_year';
create table public.connections (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(message) between 10 and 2000),
  status text not null default 'pending' check (status in ('pending','accepted','declined','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);
create unique index one_open_connection on public.connections(sender_id,recipient_id) where status in ('pending','accepted');
create index connections_sender_idx on public.connections(sender_id,created_at desc);
create index connections_recipient_idx on public.connections(recipient_id,created_at desc);
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null unique references public.connections(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 10 and 2000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index reviews_recipient_idx on public.reviews(recipient_id,status);
create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  entity_kind text not null,
  entity_id uuid not null,
  decision text not null,
  reason text not null default '',
  created_at timestamptz not null default now()
);

-- Authorization is read live from server-controlled app metadata. Users cannot set it.
create function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.users where id = (select auth.uid()) and raw_app_meta_data->>'role' = 'admin');
$$;
create function private.active_member(target uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.member_accounts a where a.user_id = target and a.moderation_status = 'approved'
    and exists(select 1 from public.membership_periods m where m.user_id = target and m.starts_at <= now() and m.expires_at > now()));
$$;
create function private.public_member(target uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.member_accounts a where a.user_id = target and a.member_type = 'china' and private.active_member(target));
$$;
create function private.visible_profile(target uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select target = (select auth.uid()) or private.is_admin() or private.public_member(target)
    or exists(select 1 from public.connections c where (c.sender_id = (select auth.uid()) and c.recipient_id = target) or (c.recipient_id = (select auth.uid()) and c.sender_id = target));
$$;
create function private.completed_count(target uuid) returns bigint language sql stable security definer set search_path = '' as $$
  select case when private.public_member(target) then (select count(*) from public.connections where recipient_id = target and status = 'completed') else 0 end;
$$;
create function private.connection_contact(target uuid) returns text language sql stable security definer set search_path = '' as $$
  select u.email from public.connections c join auth.users u on u.id = case when c.sender_id = (select auth.uid()) then c.recipient_id else c.sender_id end
  where c.id = target and c.status in ('accepted','completed') and (select auth.uid()) in (c.sender_id,c.recipient_id);
$$;

alter table public.profiles enable row level security;
alter table public.member_accounts enable row level security;
alter table public.membership_requests enable row level security;
alter table public.membership_periods enable row level security;
alter table public.connections enable row level security;
alter table public.reviews enable row level security;
alter table public.admin_audit_log enable row level security;
create policy profile_read on public.profiles for select to anon,authenticated using (private.visible_profile(id));
create policy profile_own_update on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy account_read on public.member_accounts for select to authenticated using (user_id = (select auth.uid()) or private.is_admin());
create policy membership_request_read on public.membership_requests for select to authenticated using (user_id = (select auth.uid()) or private.is_admin());
create policy membership_period_read on public.membership_periods for select to authenticated using (user_id = (select auth.uid()) or private.is_admin());
create policy connection_read on public.connections for select to authenticated using ((select auth.uid()) in (sender_id,recipient_id) or private.is_admin());
create policy review_read on public.reviews for select to anon,authenticated using ((status = 'approved' and private.public_member(recipient_id)) or reviewer_id = (select auth.uid()) or recipient_id = (select auth.uid()) or private.is_admin());
create policy audit_admin_read on public.admin_audit_log for select to authenticated using (private.is_admin());

revoke all on public.profiles,public.member_accounts,public.membership_requests,public.membership_periods,public.connections,public.reviews,public.admin_audit_log from anon,authenticated;
grant select on public.profiles,public.reviews to anon,authenticated;
grant select on public.member_accounts,public.membership_requests,public.membership_periods,public.connections,public.admin_audit_log to authenticated;
grant update (full_name,bio,city,company,specialties,languages,avatar_url,cover_url,achievements,portfolio) on public.profiles to authenticated;

create view public.member_directory with (security_invoker = true) as
  select p.*, 'china'::text as member_type, true as verified,
    (select round(avg(r.rating),1) from public.reviews r where r.recipient_id = p.id and r.status = 'approved') as rating,
    (select count(*)::integer from public.reviews r where r.recipient_id = p.id and r.status = 'approved') as review_count,
    private.completed_count(p.id) as completed_connections
  from public.profiles p where private.public_member(p.id);
grant select on public.member_directory to anon,authenticated;

-- Account creation trusts metadata only for the user's chosen lane, never privileges.
create function private.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
declare lane text; chosen_plan text; person_name text;
begin
  lane := case when new.raw_user_meta_data->>'member_type' = 'china' then 'china' else 'global' end;
  chosen_plan := case when lane = 'china' then 'china_yearly' when new.raw_user_meta_data->>'plan' = 'trip_year' then 'trip_year' else 'global_monthly' end;
  person_name := left(coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'),''),'New member'),100);
  insert into public.profiles(id,full_name) values(new.id,person_name);
  insert into public.member_accounts(user_id,member_type,preferred_plan,moderation_status)
    values(new.id,lane,chosen_plan,case when lane = 'global' then 'approved' else 'pending' end);
  return new;
end;
$$;
create trigger ambro_new_user after insert on auth.users for each row execute function private.handle_new_user();

create function private.profile_updated() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  new.id := old.id;
  new.created_at := old.created_at;
  if to_jsonb(new) - 'updated_at' is distinct from to_jsonb(old) - 'updated_at' then
    update public.member_accounts set moderation_status = 'pending',reviewed_at = null,reviewed_by = null,moderation_reason = null
      where user_id = new.id and member_type = 'china' and moderation_status = 'approved';
  end if;
  return new;
end;
$$;
create trigger ambro_profile_updated before update on public.profiles for each row execute function private.profile_updated();

-- These private implementations cannot be called via the public Data API.
create function private.request_membership(chosen_plan text, payment_reference text, member_note text) returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); lane text; result uuid;
begin
  if actor is null then raise exception 'Please sign in to continue.'; end if;
  select member_type into lane from public.member_accounts where user_id = actor and moderation_status <> 'suspended' for update;
  if lane is null then raise exception 'Your account is unavailable. Please contact the Ambro team.'; end if;
  if chosen_plan is null or not ((lane = 'china' and chosen_plan = 'china_yearly') or (lane = 'global' and chosen_plan in ('global_monthly','trip_year'))) then raise exception 'Choose a valid plan for your membership.'; end if;
  if char_length(btrim(coalesce(payment_reference,''))) not between 1 and 200 or char_length(coalesce(member_note,'')) > 1000 then raise exception 'Add a valid payment or trip booking reference.'; end if;
  if chosen_plan = 'trip_year' and exists(select 1 from public.membership_periods where user_id = actor and plan = 'trip_year') then raise exception 'Your complimentary trip membership has already been used.'; end if;
  if exists(select 1 from public.membership_requests where user_id = actor and status = 'pending') then raise exception 'You already have a membership request awaiting review.'; end if;
  insert into public.membership_requests(user_id,plan,reference,note) values(actor,chosen_plan,btrim(payment_reference),coalesce(member_note,'')) returning id into result;
  return result;
end;
$$;
create function private.request_connection(target uuid, introduction text) returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); result uuid;
begin
  if actor is null then raise exception 'Please sign in to continue.'; end if;
  perform 1 from public.member_accounts where user_id = actor for update;
  if not exists(select 1 from public.member_accounts where user_id = actor and member_type = 'global') or not private.active_member(actor) then raise exception 'An active Global membership is required to connect.'; end if;
  if actor = target or not private.public_member(target) then raise exception 'This China member is not currently available for connections.'; end if;
  if char_length(btrim(coalesce(introduction,''))) not between 10 and 2000 then raise exception 'Your introduction must be between 10 and 2000 characters.'; end if;
  if (select count(*) from public.connections where sender_id = actor and created_at > now() - interval '24 hours') >= 20 then raise exception 'You have reached the daily limit of 20 connection requests. Please try tomorrow.'; end if;
  insert into public.connections(sender_id,recipient_id,message) values(actor,target,btrim(introduction)) returning id into result;
  return result;
end;
$$;
create function private.change_connection(target uuid, new_status text) returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); item public.connections%rowtype;
begin
  if actor is null then raise exception 'Please sign in to continue.'; end if;
  select * into item from public.connections where id = target for update;
  if item.id is null or item.recipient_id <> actor then raise exception 'Only the recipient can update this connection.'; end if;
  if not private.active_member(actor) then raise exception 'An active China membership is required to manage connections.'; end if;
  if new_status is null or not ((item.status = 'pending' and new_status in ('accepted','declined')) or (item.status = 'accepted' and new_status = 'completed')) then raise exception 'This connection cannot move to that status.'; end if;
  update public.connections set status = new_status,updated_at = now() where id = target;
end;
$$;
create function private.submit_review(target uuid, stars integer, review_body text) returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); item public.connections%rowtype; result uuid;
begin
  if actor is null then raise exception 'Please sign in to continue.'; end if;
  select * into item from public.connections where id = target for update;
  if item.id is null or item.sender_id <> actor or item.status <> 'completed' then raise exception 'You can review only your own completed connections.'; end if;
  if stars is null or stars not between 1 and 5 or char_length(btrim(coalesce(review_body,''))) not between 10 and 2000 then raise exception 'Choose 1 to 5 stars and write a review between 10 and 2000 characters.'; end if;
  insert into public.reviews(connection_id,reviewer_id,recipient_id,rating,body) values(target,actor,item.recipient_id,stars,btrim(review_body)) returning id into result;
  return result;
end;
$$;
create function private.admin_decision(entity_kind text, target uuid, outcome text, decision_reason text) returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); item public.membership_requests%rowtype; lane text; begins timestamptz; ends timestamptz; amount integer;
begin
  if actor is null or not private.is_admin() then raise exception 'Administrator access is required.'; end if;
  if char_length(coalesce(decision_reason,'')) > 1000 then raise exception 'Keep your decision reason under 1000 characters.'; end if;
  if outcome is null or outcome not in ('approved','rejected','suspended') then raise exception 'Choose a valid decision.'; end if;
  if outcome in ('rejected','suspended') and char_length(btrim(coalesce(decision_reason,''))) = 0 then raise exception 'A reason is required for this decision.'; end if;
  if entity_kind = 'profile' then
    if not exists(select 1 from public.member_accounts where user_id = target) then raise exception 'Member not found.'; end if;
    if outcome = 'approved' and exists(select 1 from public.member_accounts a join public.profiles p on p.id = a.user_id where a.user_id = target and a.member_type = 'china' and (p.city = '' or p.company = '' or p.bio = '' or cardinality(p.specialties) = 0)) then raise exception 'This China profile needs a city, company, introduction and specialty before approval.'; end if;
    update public.member_accounts set moderation_status = outcome,moderation_reason = nullif(btrim(coalesce(decision_reason,'')),''),reviewed_by = actor,reviewed_at = now() where user_id = target;
  elsif entity_kind = 'membership' then
    if outcome = 'suspended' then raise exception 'Membership requests can be approved or rejected.'; end if;
    select * into item from public.membership_requests where id = target for update;
    if item.id is null or item.status <> 'pending' then raise exception 'This request has already been reviewed or does not exist.'; end if;
    select member_type into lane from public.member_accounts where user_id = item.user_id and moderation_status <> 'suspended' for update;
    if lane is null then raise exception 'This account is suspended or unavailable.'; end if;
    if not ((lane = 'china' and item.plan = 'china_yearly') or (lane = 'global' and item.plan in ('global_monthly','trip_year'))) then raise exception 'The membership plan does not match this account.'; end if;
    if outcome = 'approved' then
      if item.plan = 'trip_year' and exists(select 1 from public.membership_periods where user_id = item.user_id and plan = 'trip_year') then raise exception 'This member has already received their trip benefit.'; end if;
      select greatest(now(),coalesce(max(expires_at),now())) into begins from public.membership_periods where user_id = item.user_id;
      amount := case item.plan when 'china_yearly' then 1000 when 'global_monthly' then 100 else 0 end;
      ends := begins + case when item.plan = 'global_monthly' then interval '1 month' else interval '1 year' end;
      insert into public.membership_periods(user_id,source_request_id,plan,amount_rmb,starts_at,expires_at,approved_by) values(item.user_id,item.id,item.plan,amount,begins,ends,actor);
    end if;
    update public.membership_requests set status = outcome,rejection_reason = nullif(btrim(coalesce(decision_reason,'')),''),reviewed_by = actor,reviewed_at = now() where id = target;
  elsif entity_kind = 'review' then
    if outcome = 'suspended' then raise exception 'Reviews can be approved or rejected.'; end if;
    update public.reviews set status = outcome,reviewed_by = actor,reviewed_at = now() where id = target and status = 'pending';
    if not found then raise exception 'This review has already been reviewed or does not exist.'; end if;
  else raise exception 'Choose a valid review queue.';
  end if;
  insert into public.admin_audit_log(actor_id,entity_kind,entity_id,decision,reason) values(actor,entity_kind,target,outcome,coalesce(decision_reason,''));
end;
$$;

-- Thin invoker wrappers expose only the authenticated, validated operations above.
create function public.request_membership(chosen_plan text, payment_reference text, member_note text default '') returns uuid language sql security invoker set search_path = '' as $$ select private.request_membership(chosen_plan,payment_reference,member_note); $$;
create function public.request_connection(target uuid, introduction text) returns uuid language sql security invoker set search_path = '' as $$ select private.request_connection(target,introduction); $$;
create function public.change_connection(target uuid, new_status text) returns void language sql security invoker set search_path = '' as $$ select private.change_connection(target,new_status); $$;
create function public.submit_review(target uuid, stars integer, review_body text) returns uuid language sql security invoker set search_path = '' as $$ select private.submit_review(target,stars,review_body); $$;
create function public.admin_decision(entity_kind text, target uuid, outcome text, decision_reason text default '') returns void language sql security invoker set search_path = '' as $$ select private.admin_decision(entity_kind,target,outcome,decision_reason); $$;
create function public.connection_contact(target uuid) returns text language sql security invoker set search_path = '' as $$ select private.connection_contact(target); $$;

-- SECURITY DEFINER functions never inherit PostgreSQL's default PUBLIC execute grant.
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.is_admin(),private.public_member(uuid),private.visible_profile(uuid),private.completed_count(uuid) to anon,authenticated;
grant execute on function private.active_member(uuid),private.request_membership(text,text,text),private.request_connection(uuid,text),private.change_connection(uuid,text),private.submit_review(uuid,integer,text),private.admin_decision(text,uuid,text,text),private.connection_contact(uuid) to authenticated;
revoke all on function public.request_membership(text,text,text),public.request_connection(uuid,text),public.change_connection(uuid,text),public.submit_review(uuid,integer,text),public.admin_decision(text,uuid,text,text),public.connection_contact(uuid) from public,anon;
grant execute on function public.request_membership(text,text,text),public.request_connection(uuid,text),public.change_connection(uuid,text),public.submit_review(uuid,integer,text),public.admin_decision(text,uuid,text,text),public.connection_contact(uuid) to authenticated;

-- Public profile photos only; private payment evidence is never uploaded here.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('member-media','member-media',true,5242880,array['image/jpeg','image/png','image/webp']);
create policy media_own_read on storage.objects for select to authenticated using (bucket_id = 'member-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy media_own_insert on storage.objects for insert to authenticated with check (bucket_id = 'member-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy media_own_update on storage.objects for update to authenticated using (bucket_id = 'member-media' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'member-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy media_own_delete on storage.objects for delete to authenticated using (bucket_id = 'member-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
