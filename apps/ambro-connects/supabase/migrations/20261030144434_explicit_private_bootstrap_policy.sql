-- Explicitly document the default-deny private allowlist policy.
create policy bootstrap_no_client_access on private.admin_bootstrap_emails for all to anon,authenticated using (false) with check (false);
