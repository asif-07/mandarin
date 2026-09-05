# Security notes

This platform stores scanned passports and other identity documents. Read this before launch.

## Do before go-live

1. **Rotate the four shared passwords.** The launch passwords (`ambro@123`, `sales@123`, …) are weak and were shared in plain text in the build brief. Change them in Supabase Auth → Users, or edit `scripts/seed-users.ts` with new values and re-run it. Prefer one account per person over shared logins as soon as the team grows.
2. **Enable MFA on the Supabase project itself** (Supabase dashboard → Account → Security). The dashboard has full access to every passport scan and to the service role key.
3. **Keep the storage buckets private.** `traveller-documents`, `travel-packs` and `invoices` are created private and every download goes through a short-lived signed URL (60 to 300 seconds) generated server-side. Never flip a bucket to public and never expose a storage path to an unauthenticated user.
4. **Never expose `SUPABASE_SERVICE_ROLE_KEY`.** It bypasses Row Level Security. It is only read by the seed scripts and by `src/lib/supabase/admin.ts` (which imports `server-only`, so a client bundle that touches it fails to build). Do not prefix it with `NEXT_PUBLIC_`.
5. **Set a strong Postgres password** and do not share the database connection string.

## How access control works in v1

- Every table has Row Level Security enabled. Two policies exist per table: full access for the `authenticated` role, deny-all for `anon`.
- Invoices, leads and travel are shared by all four accounts. The Accounts module (`parties`, `deals`, `bank_accounts`, `receipts`, `expenses`, `account_transfers`, `expense_categories` and the balance views) is limited to `profiles.role = 'admin'` (ambro, asif) by RLS policies that call `public.is_admin()`; a sales or document session gets zero rows even if it calls the API directly. The UI hides the Accounts navigation for non-admins and the pages, server actions and CSV export re-check the role. To give another person access, set their profile role to `admin`.
- `next_counter()` is `SECURITY DEFINER` so counters cannot be edited directly by the app; the numbered-insert functions are `SECURITY INVOKER` so RLS still applies.
- Next.js middleware refreshes the Supabase session and redirects every route except `/login` when there is no user. API routes additionally re-check the user before doing any work.

## Operational hygiene

- Uploaded originals are never modified or hard-deleted; replacing a document soft-deletes the old row (`deleted_at`, `deleted_by`) and leaves the object in storage for the audit trail. Add a retention policy that purges storage objects of soft-deleted rows once your legal retention period is defined.
- HEIC uploads are converted to JPEG server-side. The original HEIC object stays in the bucket.
- Signed URLs for image thumbnails last one hour and are embedded in the traveller page; do not screenshot or forward that page outside the team.
- Vercel deployment logs may contain error messages with traveller names. Restrict Vercel team access accordingly.
- Consider enabling Supabase's `auth.users` leaked-password protection and setting the session lifetime to a working day.
