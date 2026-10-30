-- Configure the initial administrator privately, outside source control.
-- Only an explicitly allowed, email-verified account can consume this one-time grant.
create table private.admin_bootstrap_emails (
  email text primary key check (email = lower(btrim(email))),
  granted_at timestamptz,
  auth_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table private.admin_bootstrap_emails enable row level security;
revoke all on private.admin_bootstrap_emails from public,anon,authenticated;
create index bootstrap_user_idx on private.admin_bootstrap_emails(auth_user_id);
create function private.bootstrap_verified_admin() returns trigger language plpgsql security definer set search_path = '' as $$
declare allowed_email text;
begin
  if new.email_confirmed_at is null or new.email is null then return new; end if;
  select email into allowed_email from private.admin_bootstrap_emails
    where email = lower(new.email) and granted_at is null for update;
  if allowed_email is not null then
    update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data,'{}'::jsonb) || '{"role":"admin"}'::jsonb where id = new.id;
    update private.admin_bootstrap_emails set granted_at = now(),auth_user_id = new.id where email = allowed_email;
  end if;
  return new;
end;
$$;
revoke all on function private.bootstrap_verified_admin() from public,anon,authenticated;
create trigger ambro_bootstrap_verified_admin after insert or update of email,email_confirmed_at on auth.users for each row execute function private.bootstrap_verified_admin();

-- Saving a corrected rejected profile sends it back to review. Suspension is preserved.
create or replace function private.profile_updated() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  new.id := old.id;
  new.created_at := old.created_at;
  if to_jsonb(new) - 'updated_at' is distinct from to_jsonb(old) - 'updated_at'
    or exists(select 1 from public.member_accounts where user_id = new.id and member_type = 'china' and moderation_status = 'rejected') then
    update public.member_accounts set moderation_status = 'pending',reviewed_at = null,reviewed_by = null,moderation_reason = null
      where user_id = new.id and member_type = 'china' and moderation_status in ('approved','rejected');
  end if;
  return new;
end;
$$;
