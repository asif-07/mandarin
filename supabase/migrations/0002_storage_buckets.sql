-- Private storage buckets. Nothing in these buckets is ever public; the app
-- serves files exclusively through short-lived signed URLs created server-side.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'traveller-documents', 'traveller-documents', false, 15728640,
    array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif']
  ),
  ('travel-packs', 'travel-packs', false, null, array['application/pdf']),
  ('invoices', 'invoices', false, null, array['application/pdf'])
on conflict (id) do nothing;

-- Any signed-in team member may read and write objects in the app buckets.
create policy "authenticated read app buckets"
  on storage.objects for select to authenticated
  using (bucket_id in ('traveller-documents', 'travel-packs', 'invoices'));

create policy "authenticated insert app buckets"
  on storage.objects for insert to authenticated
  with check (bucket_id in ('traveller-documents', 'travel-packs', 'invoices'));

create policy "authenticated update app buckets"
  on storage.objects for update to authenticated
  using (bucket_id in ('traveller-documents', 'travel-packs', 'invoices'));

create policy "authenticated delete app buckets"
  on storage.objects for delete to authenticated
  using (bucket_id in ('traveller-documents', 'travel-packs', 'invoices'));
