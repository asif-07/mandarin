-- Passport names as printed: given name(s) and surname, kept next to full_name (which stays the display name).
alter table public.travellers
  add column if not exists given_name text,
  add column if not exists surname text;
