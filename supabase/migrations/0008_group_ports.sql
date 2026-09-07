-- Entry and exit ports for group visas (e.g. Guangzhou Baiyun Airport in, Shenzhen Bay Port out).
-- Nullable in the database so existing groups keep working; the app requires both on save.
alter table public.travel_groups add column if not exists entry_port text;
alter table public.travel_groups add column if not exists exit_port text;
