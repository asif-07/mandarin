-- An AFTER trigger's nested UPDATE is absent from the outer Auth RETURNING row.
-- Normalize NEW directly so Auth receives the administrator role, and protect the
-- explicitly bound verified account from later provider-metadata refreshes.
drop trigger ambro_bootstrap_verified_admin on auth.users;
create or replace function private.bootstrap_verified_admin() returns trigger language plpgsql security definer set search_path = '' as $$
declare allowed_email text;
begin
  if new.email_confirmed_at is null or new.email is null then return new; end if;
  select email into allowed_email from private.admin_bootstrap_emails
    where email = lower(new.email)
      and ((granted_at is null and auth_user_id is null) or auth_user_id = new.id)
    for update;
  if allowed_email is not null then
    new.raw_app_meta_data := coalesce(new.raw_app_meta_data,'{}'::jsonb) || jsonb_build_object('role','admin');
  end if;
  return new;
end;
$$;
create function private.finalize_admin_bootstrap() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is not null and new.email is not null and new.raw_app_meta_data->>'role' = 'admin' then
    update private.admin_bootstrap_emails set granted_at = now(),auth_user_id = new.id
      where email = lower(new.email) and granted_at is null and auth_user_id is null;
  end if;
  return new;
end;
$$;
revoke all on function private.bootstrap_verified_admin(),private.finalize_admin_bootstrap() from public,anon,authenticated;
create trigger ambro_bootstrap_verified_admin before insert or update of email,email_confirmed_at,raw_app_meta_data on auth.users for each row execute function private.bootstrap_verified_admin();
create trigger ambro_finalize_admin_bootstrap after insert or update of email,email_confirmed_at,raw_app_meta_data on auth.users for each row execute function private.finalize_admin_bootstrap();

-- Trusted revocation: remove the private allowlist entry before changing this
-- account's app_metadata role. Ordinary users have no access to that allowlist.
