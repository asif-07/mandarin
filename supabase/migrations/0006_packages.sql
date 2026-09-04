-- Hotel packages: a new enquiry type with a 3 / 4 / 5 star tier on leads and travellers.

alter table public.leads drop constraint if exists leads_enquiry_type_check;
alter table public.leads add constraint leads_enquiry_type_check
  check (enquiry_type in ('144hr_visa', 'canton_fair_package', 'china_business_visa', 'group_tour', 'package', 'other'));

alter table public.leads add column if not exists package_tier text
  check (package_tier is null or package_tier in ('3_star', '4_star', '5_star'));

alter table public.travellers add column if not exists package_tier text
  check (package_tier is null or package_tier in ('3_star', '4_star', '5_star'));

create index if not exists travellers_package_tier_idx on public.travellers (package_tier) where package_tier is not null;
