-- No real accounts or email delivery. The whole fixture transaction is rolled back.
begin;
insert into private.admin_bootstrap_emails(email) values('admin-bootstrap-qa@example.invalid');
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values
('b0000000-0000-4000-8000-000000000011','admin-bootstrap-qa@example.invalid','{"full_name":"Bootstrap QA","member_type":"global","role":"admin"}','{"provider":"email","providers":["email"]}'),
('b0000000-0000-4000-8000-000000000012','unlisted-bootstrap-qa@example.invalid','{"full_name":"Unlisted QA","member_type":"global","role":"admin"}','{"provider":"email"}');
do $$
declare returned_metadata jsonb; bound_user uuid; originally_granted timestamptz;
begin
  if exists(select 1 from auth.users where id = 'b0000000-0000-4000-8000-000000000011' and raw_app_meta_data->>'role' = 'admin') then raise exception 'Unverified account became admin'; end if;
  update auth.users set email_confirmed_at = now() where id = 'b0000000-0000-4000-8000-000000000011' returning raw_app_meta_data into returned_metadata;
  if returned_metadata->>'role' is distinct from 'admin' then raise exception 'Auth RETURNING record lacks admin role'; end if;
  select auth_user_id,granted_at into bound_user,originally_granted from private.admin_bootstrap_emails where email = 'admin-bootstrap-qa@example.invalid';
  if bound_user is distinct from 'b0000000-0000-4000-8000-000000000011'::uuid or originally_granted is null then raise exception 'Grant was not bound and finalized'; end if;
  -- Reproduce the subsequent provider metadata write that previously lost the grant.
  update auth.users set raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb where id = bound_user returning raw_app_meta_data into returned_metadata;
  if returned_metadata->>'role' is distinct from 'admin' then raise exception 'Provider metadata write removed the granted role'; end if;
  if (select granted_at from private.admin_bootstrap_emails where email = 'admin-bootstrap-qa@example.invalid') is distinct from originally_granted then raise exception 'Grant timestamp was rewritten'; end if;
  update auth.users set email_confirmed_at = now() where id = 'b0000000-0000-4000-8000-000000000012' returning raw_app_meta_data into returned_metadata;
  if returned_metadata->>'role' = 'admin' then raise exception 'Unlisted account or user_metadata gained admin'; end if;
  -- An email reused by another account must not inherit a consumed binding.
  update auth.users set email = 'old-admin-bootstrap-qa@example.invalid' where id = bound_user;
  update auth.users set email = 'admin-bootstrap-qa@example.invalid' where id = 'b0000000-0000-4000-8000-000000000012' returning raw_app_meta_data into returned_metadata;
  if returned_metadata->>'role' = 'admin' then raise exception 'Another identity inherited a consumed grant'; end if;
  -- A trusted operator can revoke by removing the allowlist before changing role.
  delete from private.admin_bootstrap_emails where email = 'admin-bootstrap-qa@example.invalid';
  update auth.users set raw_app_meta_data = raw_app_meta_data - 'role' where id = bound_user returning raw_app_meta_data into returned_metadata;
  if returned_metadata->>'role' = 'admin' then raise exception 'Trusted revocation did not work'; end if;
end;
$$;
select 'PASS: verified bootstrap, Auth RETURNING, later provider writes, bound identity and trusted revocation' as result;
rollback;
