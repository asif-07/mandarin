-- Reference data so the app has something to show on first login.
-- Idempotent: every row has a fixed UUID and uses ON CONFLICT DO NOTHING.
-- Run after the four team accounts exist (scripts/seed-users.ts).
-- Sample document files are uploaded by scripts/seed-data.ts (needs storage access).

-- Customers ------------------------------------------------------------------
insert into public.customers (id, full_name, phone, email, nationality, passport_number, created_by) values
  ('a0000000-0000-4000-8000-000000000001', 'Shareer Shahudeen', '+971554720259', 'shareer@example.com', 'Indian', 'N1234567', (select id from public.profiles where username = 'sales')),
  ('a0000000-0000-4000-8000-000000000002', 'Fatima Al Mansoori', '+971501234567', 'fatima@example.com', 'Emirati', 'A9876543', (select id from public.profiles where username = 'sales')),
  ('a0000000-0000-4000-8000-000000000003', 'Rajesh Kumar', '+919876543210', 'rajesh@example.com', 'Indian', 'Z5566778', (select id from public.profiles where username = 'asif'))
on conflict (id) do nothing;

-- Leads ----------------------------------------------------------------------
insert into public.leads (id, lead_ref, customer_id, full_name, phone, email, country, city, entry_city, enquiry_type, source, status, lost_reason, pax_count, travel_month, canton_phase, quoted_amount, quoted_currency, assigned_to, next_followup_date, notes, created_by, created_at) values
  ('b0000000-0000-4000-8000-000000000001', 'LD-2026-0001', 'a0000000-0000-4000-8000-000000000001', 'Shareer Shahudeen', '+971554720259', 'shareer@example.com', 'UAE', 'Dubai', 'Guangzhou', '144hr_visa', 'whatsapp', 'won', null, 5, '25-30 Aug 2026', null, 220, 'USD', (select id from public.profiles where username = 'sales'), null, 'Family of five, Canton visit plus Guangzhou sightseeing.', (select id from public.profiles where username = 'sales'), '2026-08-18 09:15+04'),
  ('b0000000-0000-4000-8000-000000000002', 'LD-2026-0002', 'a0000000-0000-4000-8000-000000000002', 'Fatima Al Mansoori', '+971501234567', 'fatima@example.com', 'UAE', 'Abu Dhabi', null, 'canton_fair_package', 'instagram', 'quoted', null, 2, 'Oct 2026', 'phase_2', 1850, 'USD', (select id from public.profiles where username = 'sales'), current_date, 'Interested in the Phase 2 package with hotel near Pazhou.', (select id from public.profiles where username = 'sales'), '2026-08-28 14:40+04'),
  ('b0000000-0000-4000-8000-000000000003', 'LD-2026-0003', 'a0000000-0000-4000-8000-000000000003', 'Rajesh Kumar', '+919876543210', 'rajesh@example.com', 'India', 'Mumbai', 'Shenzhen', 'china_business_visa', 'referral', 'negotiating', null, 1, 'Sep 2026', null, 320, 'USD', (select id from public.profiles where username = 'asif'), current_date - 2, 'Needs M visa for supplier visits in Shenzhen. Asked for a discount.', (select id from public.profiles where username = 'asif'), '2026-08-25 11:05+04'),
  ('b0000000-0000-4000-8000-000000000004', 'LD-2026-0004', null, 'Mohammed Al Harthy', '+96891234567', null, 'Oman', 'Muscat', 'Guangzhou', '144hr_visa', 'facebook', 'new', null, 3, 'Oct 2026', null, null, 'USD', (select id from public.profiles where username = 'sales'), null, null, (select id from public.profiles where username = 'sales'), now() - interval '3 hours'),
  ('b0000000-0000-4000-8000-000000000005', 'LD-2026-0005', null, 'Noura Al Thani', '+97455512345', 'noura@example.com', 'Qatar', 'Doha', null, 'group_tour', 'website', 'contacted', null, 8, 'Dec 2026', null, null, 'USD', (select id from public.profiles where username = 'ambro'), current_date + 2, 'Corporate group of eight; wants itinerary options.', (select id from public.profiles where username = 'ambro'), '2026-08-30 16:20+04'),
  ('b0000000-0000-4000-8000-000000000006', 'LD-2026-0006', null, 'Ahmed Hassan', '+971529876543', null, 'UAE', 'Sharjah', null, 'canton_fair_package', 'whatsapp', 'lost', 'price', 1, 'Oct 2026', 'phase_1', 1600, 'USD', (select id from public.profiles where username = 'sales'), null, null, (select id from public.profiles where username = 'sales'), '2026-08-20 10:00+04')
on conflict (id) do nothing;

insert into public.lead_activities (id, lead_id, activity_type, body, old_status, new_status, created_by, created_at) values
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'whatsapp', 'Sent 144-hour transit requirements and price list.', null, null, (select id from public.profiles where username = 'sales'), '2026-08-18 09:30+04'),
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'status_change', 'Moved to Quoted', 'contacted', 'quoted', (select id from public.profiles where username = 'sales'), '2026-08-19 12:00+04'),
  ('c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'status_change', 'Moved to Won', 'quoted', 'won', (select id from public.profiles where username = 'sales'), '2026-08-22 10:10+04'),
  ('c0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000002', 'call', 'Discussed Phase 2 dates and hotel options. Sending quote.', null, null, (select id from public.profiles where username = 'sales'), '2026-08-29 13:00+04'),
  ('c0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000003', 'note', 'Asked for USD 280. Holding at 320 for now.', null, null, (select id from public.profiles where username = 'asif'), '2026-08-27 15:45+04'),
  ('c0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000006', 'status_change', 'Moved to Lost (Price)', 'quoted', 'lost', (select id from public.profiles where username = 'sales'), '2026-08-24 09:00+04')
on conflict (id) do nothing;

-- Invoices -------------------------------------------------------------------
insert into public.invoices (id, invoice_number, sequence_number, issue_date, due_date_label, currency, bill_to_name, bill_to_phone, bill_to_email, bill_to_address, visa_reference, subtotal, tax, total, amount_in_words, terms, status, lead_id, customer_id, created_by, created_at) values
  ('d0000000-0000-4000-8000-000000000179', 'MR-2026-179', 179, '2026-08-22', 'On Receipt', 'USD', 'Shareer Shahudeen', '+971 55 472 0259', null, null, 'MR144-Aug25-Aug30-05px-G01', 220, 0, 220, 'US Dollars Two Hundred and Twenty Only', E'Payment due on receipt.\nVisa charges are non-refundable once the application is submitted.\nAll bank transfer charges are borne by the payer.', 'issued', 'b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', (select id from public.profiles where username = 'sales'), '2026-08-22 10:30+04'),
  ('d0000000-0000-4000-8000-000000000180', 'MR-2026-180', 180, '2026-09-01', 'On Receipt', 'USD', 'Fatima Al Mansoori', '+971 50 123 4567', 'fatima@example.com', 'Abu Dhabi, UAE', null, 1850, 0, 1850, 'US Dollars One Thousand Eight Hundred and Fifty Only', E'Payment due on receipt.\nVisa charges are non-refundable once the application is submitted.\nAll bank transfer charges are borne by the payer.', 'draft', 'b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', (select id from public.profiles where username = 'sales'), '2026-09-01 11:00+04')
on conflict (id) do nothing;

insert into public.invoice_items (id, invoice_id, position, title, description, reference, quantity, rate, amount) values
  ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000179', 1, 'Visa Charges', 'Visa application and processing fee', 'MR144-Aug25-Aug30-05px-G01', 1, 140, 140),
  ('e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000179', 2, 'Service Charges', 'Documentation, coordination and handling', null, 1, 80, 80),
  ('e0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000180', 1, 'Canton Fair Package', 'Phase 2 package: hotel, transfers and fair registration (2 pax)', null, 1, 1850, 1850)
on conflict (id) do nothing;

-- Travel groups --------------------------------------------------------------
insert into public.travel_groups (id, group_code, travel_date, label, guide_name, created_by) values
  ('f0000000-0000-4000-8000-000000000001', 'G01', '2026-10-15', 'Canton Phase 2 - Morning', 'Li Wei', (select id from public.profiles where username = 'document')),
  ('f0000000-0000-4000-8000-000000000002', 'G02', '2026-10-15', 'Canton Phase 2 - Morning', 'Chen Jing', (select id from public.profiles where username = 'document')),
  ('f0000000-0000-4000-8000-000000000003', 'G03', '2026-10-15', 'Canton Phase 2 - Afternoon', null, (select id from public.profiles where username = 'document')),
  ('f0000000-0000-4000-8000-000000000004', 'G01', current_date + 4, '144hr transit', 'Li Wei', (select id from public.profiles where username = 'document'))
on conflict (travel_date, group_code) do nothing;

-- Travellers -----------------------------------------------------------------
insert into public.travellers (id, traveller_ref, customer_id, lead_id, invoice_id, full_name, phone, email, passport_number, nationality, travel_start_date, travel_end_date, travel_group_id, visa_reference, status, created_by) values
  ('90000000-0000-4000-8000-000000000001', 'TR-2026-0001', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000179', 'Shareer Shahudeen', '+971554720259', 'shareer@example.com', 'N1234567', 'Indian', '2026-10-15', '2026-10-20', 'f0000000-0000-4000-8000-000000000001', 'MR144-Aug25-Aug30-05px-G01', 'documents_pending', (select id from public.profiles where username = 'document')),
  ('90000000-0000-4000-8000-000000000002', 'TR-2026-0002', 'a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', null, 'Fatima Al Mansoori', '+971501234567', 'fatima@example.com', 'A9876543', 'Emirati', '2026-10-15', '2026-10-19', 'f0000000-0000-4000-8000-000000000001', null, 'documents_pending', (select id from public.profiles where username = 'document')),
  ('90000000-0000-4000-8000-000000000003', 'TR-2026-0003', 'a0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000003', null, 'Rajesh Kumar', '+919876543210', 'rajesh@example.com', 'Z5566778', 'Indian', current_date + 4, current_date + 9, (select id from public.travel_groups where travel_date = current_date + 4 and group_code = 'G01'), 'MR144-Sep-G01', 'documents_pending', (select id from public.profiles where username = 'document'))
on conflict (id) do nothing;

-- Counters: next invoice is 181, next lead LD-2026-0007, next traveller TR-2026-0004
update public.counters set current_value = greatest(current_value, 180) where key = 'invoice_2026';
update public.counters set current_value = greatest(current_value, 6) where key = 'lead_2026';
update public.counters set current_value = greatest(current_value, 3) where key = 'traveller_2026';
