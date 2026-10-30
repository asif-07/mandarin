-- Record both participants' explicit consent before sharing their account email.
alter table public.connections add column sender_email_consent_at timestamptz, add column recipient_email_consent_at timestamptz;
drop function public.request_connection(uuid,text);
drop function private.request_connection(uuid,text);
drop function public.change_connection(uuid,text);
drop function private.change_connection(uuid,text);
create function private.request_connection(target uuid, introduction text, email_consent boolean) returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); result uuid;
begin
  if actor is null then raise exception 'Please sign in to continue.'; end if;
  if email_consent is distinct from true then raise exception 'Agree to share your account email when this member accepts your request.'; end if;
  perform 1 from public.member_accounts where user_id = actor for update;
  if not exists(select 1 from public.member_accounts where user_id = actor and member_type = 'global') or not private.active_member(actor) then raise exception 'An active Global membership is required to connect.'; end if;
  if actor = target or not private.public_member(target) then raise exception 'This China member is not currently available for connections.'; end if;
  if char_length(btrim(coalesce(introduction,''))) not between 10 and 2000 then raise exception 'Your introduction must be between 10 and 2000 characters.'; end if;
  if (select count(*) from public.connections where sender_id = actor and created_at > now() - interval '24 hours') >= 20 then raise exception 'You have reached the daily limit of 20 connection requests. Please try tomorrow.'; end if;
  insert into public.connections(sender_id,recipient_id,message,sender_email_consent_at) values(actor,target,btrim(introduction),now()) returning id into result;
  return result;
end;
$$;
create function private.change_connection(target uuid, new_status text, email_consent boolean) returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); item public.connections%rowtype;
begin
  if actor is null then raise exception 'Please sign in to continue.'; end if;
  select * into item from public.connections where id = target for update;
  if item.id is null or item.recipient_id <> actor then raise exception 'Only the recipient can update this connection.'; end if;
  if not private.active_member(actor) then raise exception 'An active China membership is required to manage connections.'; end if;
  if new_status is null or not ((item.status = 'pending' and new_status in ('accepted','declined')) or (item.status = 'accepted' and new_status = 'completed')) then raise exception 'This connection cannot move to that status.'; end if;
  if new_status = 'accepted' and email_consent is distinct from true then raise exception 'Agree to share your account email to accept this connection.'; end if;
  update public.connections set status = new_status,updated_at = now(),recipient_email_consent_at = case when new_status = 'accepted' then now() else recipient_email_consent_at end where id = target;
end;
$$;
create or replace function private.connection_contact(target uuid) returns text language sql stable security definer set search_path = '' as $$
  select u.email from public.connections c join auth.users u on u.id = case when c.sender_id = (select auth.uid()) then c.recipient_id else c.sender_id end
  where c.id = target and c.status in ('accepted','completed') and c.sender_email_consent_at is not null and c.recipient_email_consent_at is not null and (select auth.uid()) in (c.sender_id,c.recipient_id);
$$;
create function private.connection_contacts(targets uuid[]) returns table(connection_id uuid,contact_email text) language sql stable security definer set search_path = '' as $$
  select c.id,u.email from public.connections c join auth.users u on u.id = case when c.sender_id = (select auth.uid()) then c.recipient_id else c.sender_id end
  where c.id = any(targets) and c.status in ('accepted','completed') and c.sender_email_consent_at is not null and c.recipient_email_consent_at is not null and (select auth.uid()) in (c.sender_id,c.recipient_id);
$$;
create function public.request_connection(target uuid, introduction text, email_consent boolean default false) returns uuid language sql security invoker set search_path = '' as $$ select private.request_connection(target,introduction,email_consent); $$;
create function public.change_connection(target uuid, new_status text, email_consent boolean default false) returns void language sql security invoker set search_path = '' as $$ select private.change_connection(target,new_status,email_consent); $$;
create function public.connection_contacts(targets uuid[]) returns table(connection_id uuid,contact_email text) language sql security invoker set search_path = '' as $$ select * from private.connection_contacts(targets); $$;
revoke all on function private.request_connection(uuid,text,boolean),private.change_connection(uuid,text,boolean),private.connection_contacts(uuid[]),public.request_connection(uuid,text,boolean),public.change_connection(uuid,text,boolean),public.connection_contacts(uuid[]) from public,anon,authenticated;
grant execute on function private.request_connection(uuid,text,boolean),private.change_connection(uuid,text,boolean),private.connection_contacts(uuid[]),public.request_connection(uuid,text,boolean),public.change_connection(uuid,text,boolean),public.connection_contacts(uuid[]) to authenticated;

-- Bound public profile payloads even when the Data API is called directly.
create function private.valid_portfolio(items jsonb) returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 12 and coalesce((select bool_and(coalesce(
    jsonb_typeof(item) = 'object' and jsonb_typeof(item->'title') = 'string' and char_length(item->>'title') between 1 and 150
    and jsonb_typeof(item->'description') = 'string' and char_length(item->>'description') <= 1000
    and jsonb_typeof(item->'image_url') = 'string' and char_length(item->>'image_url') <= 1000,false)) from jsonb_array_elements(items) item),true);
$$;
revoke all on function private.valid_portfolio(jsonb) from public;
grant execute on function private.valid_portfolio(jsonb) to authenticated;
alter table public.profiles add constraint valid_profile_portfolio check (private.valid_portfolio(portfolio));
alter table public.profiles add constraint bounded_profile_arrays check (
  octet_length(array_to_string(specialties,',')) <= 1200 and octet_length(array_to_string(languages,',')) <= 600 and octet_length(array_to_string(achievements,',')) <= 6000
);
create index member_accounts_reviewer_idx on public.member_accounts(reviewed_by);
create index membership_requests_reviewer_idx on public.membership_requests(reviewed_by);
create index membership_periods_approver_idx on public.membership_periods(approved_by);
create index reviews_reviewer_idx on public.reviews(reviewer_id);
create index reviews_moderator_idx on public.reviews(reviewed_by);
create index audit_actor_idx on public.admin_audit_log(actor_id);
