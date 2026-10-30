-- Existing Global profiles remain private. Opting into the directory requires review.
alter table public.profiles add column network_visible boolean not null default false;
grant update (network_visible) on public.profiles to authenticated;

-- Text-only professional fields may not publish contact details. Photo URLs are
-- deliberately excluded: their UUID paths contain digit sequences and are images.
create function private.safe_public_text(value text) returns boolean language sql immutable set search_path = '' as $$
  select not (coalesce(value,'') ~* '[[:alnum:]_.%+\-]+@[[:alnum:].\-]+\.[[:alpha:]]{2,}'
    or coalesce(value,'') ~* '(wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|whatsapp:)'
    or regexp_replace(coalesce(value,''),'\m[12][0-9]{3}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])\M',' [date] ','g')
      ~ '(^|[^[:alnum:]])\+?[0-9]([[:space:]().-]*[0-9]){8,}([^[:alnum:]]|$)');
$$;
create function private.guard_public_profile_text() returns trigger language plpgsql security definer set search_path = '' as $$
declare value text;
begin
  for value in
    select unnest(array[new.full_name,new.bio,new.city,new.company] || new.specialties || new.languages || new.achievements)
    union all select item->>'title' from jsonb_array_elements(new.portfolio) item
    union all select item->>'description' from jsonb_array_elements(new.portfolio) item
  loop
    if not private.safe_public_text(value) then
      raise exception 'Keep email addresses, phone numbers and WhatsApp links out of profile text. Share contact details through an accepted connection.';
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function private.safe_public_text(text),private.guard_public_profile_text() from public,anon,authenticated;
create trigger ambro_profile_contact_guard before insert or update on public.profiles for each row execute function private.guard_public_profile_text();

create function private.guard_public_review_text() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not private.safe_public_text(new.body) then
    raise exception 'Keep email addresses, phone numbers and WhatsApp links out of review text.';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_public_review_text() from public,anon,authenticated;
create trigger ambro_review_contact_guard before insert or update on public.reviews for each row execute function private.guard_public_review_text();

create table public.demo_members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 1 and 100),
  bio text not null default '' check (char_length(bio) <= 2000),
  city text not null default '' check (char_length(city) <= 100),
  company text not null default '' check (char_length(company) <= 150),
  specialties text[] not null default '{}' check (cardinality(specialties) <= 12),
  languages text[] not null default '{}' check (cardinality(languages) <= 12),
  avatar_url text not null default '' check (char_length(avatar_url) <= 1000),
  cover_url text not null default '' check (char_length(cover_url) <= 1000),
  achievements text[] not null default '{}' check (cardinality(achievements) <= 12),
  portfolio jsonb not null default '[]'::jsonb check (private.valid_portfolio(portfolio)),
  member_type text not null check (member_type in ('china','global')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (octet_length(array_to_string(specialties,',')) <= 1200 and octet_length(array_to_string(languages,',')) <= 600 and octet_length(array_to_string(achievements,',')) <= 6000)
);
alter table public.demo_members enable row level security;
revoke all on public.demo_members from public,anon,authenticated;
grant select on public.demo_members to anon,authenticated;
create policy demo_member_read on public.demo_members for select to anon,authenticated using (enabled or private.is_admin());
create trigger ambro_demo_contact_guard before insert or update on public.demo_members for each row execute function private.guard_public_profile_text();

create or replace function private.public_member(target uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.member_accounts a join public.profiles p on p.id = a.user_id
    where a.user_id = target and private.active_member(target)
      and (a.member_type = 'china' or (a.member_type = 'global' and p.network_visible)));
$$;
create function private.public_member_type(target uuid) returns text language sql stable security definer set search_path = '' as $$
  select member_type from public.member_accounts where user_id = target and private.public_member(target);
$$;
revoke all on function private.public_member_type(uuid) from public,anon,authenticated;
grant execute on function private.public_member_type(uuid) to anon,authenticated;

create or replace function private.profile_updated() returns trigger language plpgsql security definer set search_path = '' as $$
declare content_changed boolean;
begin
  new.updated_at := now();
  new.id := old.id;
  new.created_at := old.created_at;
  content_changed := to_jsonb(new) - 'updated_at' - 'network_visible' is distinct from to_jsonb(old) - 'updated_at' - 'network_visible';
  -- China remains review-controlled. Global publishing/re-publishing is opt-in;
  -- hiding an unchanged approved Global profile does not revoke its membership.
  update public.member_accounts set moderation_status = 'pending',reviewed_at = null,reviewed_by = null,moderation_reason = null
    where user_id = new.id and moderation_status in ('approved','rejected') and (
      (member_type = 'china' and (content_changed or moderation_status = 'rejected'))
      or (member_type = 'global' and (moderation_status = 'rejected' or (new.network_visible and (not old.network_visible or content_changed))))
    );
  return new;
end;
$$;

-- A security-invoker UNION preserves the RLS of both real profiles and demo rows.
-- Demo rows can never claim reviewed status, ratings, or completed business.
create or replace view public.member_directory with (security_invoker = true) as
  select p.id,p.full_name,p.bio,p.city,p.company,p.specialties,p.languages,p.avatar_url,p.cover_url,p.achievements,p.portfolio,p.created_at,p.updated_at,
    private.public_member_type(p.id) as member_type,true as verified,
    (select round(avg(r.rating),1) from public.reviews r where r.recipient_id = p.id and r.status = 'approved') as rating,
    (select count(*)::integer from public.reviews r where r.recipient_id = p.id and r.status = 'approved') as review_count,
    private.completed_count(p.id) as completed_connections,p.network_visible,false as is_demo
  from public.profiles p where private.public_member(p.id)
  union all
  select d.id,d.full_name,d.bio,d.city,d.company,d.specialties,d.languages,d.avatar_url,d.cover_url,d.achievements,d.portfolio,d.created_at,d.updated_at,
    d.member_type,false as verified,null::numeric as rating,0::integer as review_count,0::bigint as completed_connections,true as network_visible,true as is_demo
  from public.demo_members d where d.enabled;
grant select on public.member_directory to anon,authenticated;

create or replace function private.request_connection(target uuid, introduction text, email_consent boolean) returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); result uuid;
begin
  if actor is null then raise exception 'Please sign in to continue.'; end if;
  if email_consent is distinct from true then raise exception 'Agree to share your account email when this member accepts your request.'; end if;
  perform 1 from public.member_accounts where user_id = actor for update;
  if not exists(select 1 from public.member_accounts where user_id = actor and member_type = 'global') or not private.active_member(actor) then raise exception 'An active Global membership is required to connect.'; end if;
  if exists(select 1 from public.demo_members where id = target) then raise exception 'Demo profiles cannot receive connection requests.'; end if;
  if actor = target or not private.public_member(target) then raise exception 'This member is not currently available for connections.'; end if;
  if char_length(btrim(coalesce(introduction,''))) not between 10 and 2000 then raise exception 'Your introduction must be between 10 and 2000 characters.'; end if;
  if (select count(*) from public.connections where sender_id = actor and created_at > now() - interval '24 hours') >= 20 then raise exception 'You have reached the daily limit of 20 connection requests. Please try tomorrow.'; end if;
  insert into public.connections(sender_id,recipient_id,message,sender_email_consent_at) values(actor,target,btrim(introduction),now()) returning id into result;
  return result;
end;
$$;
create or replace function private.change_connection(target uuid, new_status text, email_consent boolean) returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); item public.connections%rowtype;
begin
  if actor is null then raise exception 'Please sign in to continue.'; end if;
  select * into item from public.connections where id = target for update;
  if item.id is null or item.recipient_id <> actor then raise exception 'Only the recipient can update this connection.'; end if;
  if not private.active_member(actor) then raise exception 'An active membership is required to manage connections.'; end if;
  if new_status is null or not ((item.status = 'pending' and new_status in ('accepted','declined')) or (item.status = 'accepted' and new_status = 'completed')) then raise exception 'This connection cannot move to that status.'; end if;
  if new_status = 'accepted' and email_consent is distinct from true then raise exception 'Agree to share your account email to accept this connection.'; end if;
  update public.connections set status = new_status,updated_at = now(),recipient_email_consent_at = case when new_status = 'accepted' then now() else recipient_email_consent_at end where id = target;
end;
$$;

create function private.set_demo_members_visible(visible boolean) returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not private.is_admin() then raise exception 'Administrator access is required.'; end if;
  if visible is null then raise exception 'Choose whether to show or hide demo profiles.'; end if;
  update public.demo_members set enabled = visible,updated_at = now();
  insert into public.admin_audit_log(actor_id,entity_kind,entity_id,decision,reason)
    values((select auth.uid()),'demo_directory',gen_random_uuid(),case when visible then 'show_all' else 'hide_all' end,'Changed demo profile visibility');
end;
$$;
create function public.set_demo_members_visible(visible boolean) returns void language sql security invoker set search_path = '' as $$ select private.set_demo_members_visible(visible); $$;
revoke all on function private.set_demo_members_visible(boolean),public.set_demo_members_visible(boolean) from public,anon,authenticated;
grant execute on function private.set_demo_members_visible(boolean),public.set_demo_members_visible(boolean) to authenticated;
