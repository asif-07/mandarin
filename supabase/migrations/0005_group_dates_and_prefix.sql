-- Travel groups get a date range (travel_date = start) and a reference prefix
-- used to name the merged group PDF, e.g. MR144-Aug25-Aug30-05px-G01.pdf

alter table public.travel_groups add column if not exists travel_end_date date;
update public.travel_groups set travel_end_date = travel_date where travel_end_date is null;
alter table public.travel_groups alter column travel_end_date set not null;

alter table public.travel_groups add column if not exists reference_prefix text not null default 'MR144';
