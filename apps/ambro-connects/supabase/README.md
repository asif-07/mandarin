# Ambro Connects database

This schema belongs to the **separate Ambro Connects Supabase project**. It does not extend the Mandarin Roots operations database. Never run these migrations against the Mandarin Roots project.

The app needs only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Its server routes use the signed-in member's cookie session and RLS. No service key belongs in the browser or is required by the app.

## Membership and moderation

- China: RMB 1,000 per calendar year, subject to both profile review and payment approval.
- Global: RMB 100 per calendar month, subject to payment approval.
- Trip benefit: one complimentary calendar year per account, after the team verifies the booking.
- Submitting a reference creates a pending request. Only an administrator decision creates an immutable membership period. Renewals extend the latest existing end date.
- China profile edits remove its public listing until review. A rejected profile can be saved for another review; suspension persists.
- Connections require an active Global sender and an approved, active China recipient. Only the recipient can accept, decline, or complete the request. Email sharing requires both recorded consents.
- One review is allowed per completed connection, by its Global sender. Public ratings include only approved reviews.

Profiles expose professional content only. Private account state, billing references and connection records have separate RLS. The directory view uses `security_invoker`. Mutations are authenticated invoker wrappers over private functions that validate authorization. Administrator checks use current, server-controlled `auth.users.raw_app_meta_data`; user metadata cannot grant a role.

## Administrator bootstrap

The private `admin_bootstrap_emails` allowlist is configured in the database, outside source control. An allowed email receives `app_metadata.role = admin` only after email verification. The email is bound once to that user ID. A BEFORE trigger assigns the role to the actual Auth return record and preserves it for that same verified, bound identity across later provider metadata refreshes. A different user cannot inherit a consumed binding. Email confirmation must remain enabled. Other administrators may be assigned only through a trusted server/database operation. To revoke the configured initial administrator, a trusted operator must remove its private allowlist entry before changing its app metadata role.

## Auth and media setup

Configure the production Site URL and allow the `/auth/callback` redirect, including its `?next=/auth/reset` variation. Use a custom SMTP provider before public onboarding: Supabase's default mail service only delivers to organization team addresses. Do not disable email verification as a workaround.

The member-media bucket contains public profile photos; links are readable even while a profile is pending. Storage writes are restricted to the authenticated user's UUID folder and JPEG/PNG/WebP files up to 5 MB. The app's routed upload cap is 4 MB to fit Vercel's request limit. Membership references are text only and never use this public bucket.

## Verification

`tests/security.sql` runs entirely inside a rolled-back transaction. It verifies anonymous privacy, immutable membership activation, pricing and dates, role escalation prevention, admin email verification, connection authorization and consent, completed-only unique reviews, media ownership, profile resubmission and suspension. Fixtures use reserved `.invalid` addresses and do not send mail. Run it only in the Ambro Connects project.

`tests/admin-bootstrap.sql` verifies the Auth write boundary specifically: no elevation before verification, the admin role appears in `UPDATE ... RETURNING`, subsequent provider metadata writes preserve the grant, email reuse cannot transfer it to a different user ID, and trusted revocation works. This also rolls back all fixtures.

The migration security advisor and these SQL checks were run against the isolated project. App API smoke checks cover unauthenticated access, cross-site rejection, input validation, callback redirect safety and `no-store` responses.

`../scripts/qa-http-lifecycle.cjs` was also run against the real local app and this database using temporary verified `.invalid` fixture identities. It exercised Auth login/cookies, own profile editing, a real photo upload, pending membership restrictions, administrator approvals, active discovery, connection consent and transitions, review uniqueness/moderation and public ratings. Photos were deleted, sessions signed out and every fixture account, membership, connection, review and audit row was removed afterward; temporary credentials were deleted. The script requires a private `AMBRO_QA_CREDENTIALS` fixture file and trusted operator setup/cleanup. It never prints passwords. It does not send mail.

End-to-end email confirmation still requires a configured mail provider and the user's real inbox.
