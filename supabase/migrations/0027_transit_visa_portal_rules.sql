-- 144-hour transit visa portal: passport back page as its own slot, the
-- Hong Kong PAR question per passenger, and how many travel together.
alter table public.traveller_documents drop constraint if exists traveller_documents_doc_type_check;
alter table public.traveller_documents add constraint traveller_documents_doc_type_check
  check (doc_type in ('par', 'passport', 'passport_back', 'flight_ticket', 'hotel_booking', 'photo', 'pan_card', 'other'));
-- Merge order now: PAR 1, passport 2, passport back 3, flight 4, hotel 5, photo 6, PAN 7, other 8+
update public.traveller_documents set merge_order = case doc_type
  when 'par' then 1 when 'passport' then 2 when 'passport_back' then 3 when 'flight_ticket' then 4
  when 'hotel_booking' then 5 when 'photo' then 6 when 'pan_card' then 7 else merge_order + 3 end
where doc_type <> 'other' or merge_order < 8;

alter table public.travellers
  add column if not exists par_answer text check (par_answer in ('has_par', 'needs_par')),
  add column if not exists par_requested_at timestamptz;

alter table public.portal_applications add column if not exists pax integer check (pax is null or (pax > 0 and pax <= 999));
