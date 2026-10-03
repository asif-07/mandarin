-- B2B partner portal, China Visa Team extension and the group workflow that
-- moves one Group record from partner submission through company approval,
-- visa processing, visa approval, guide assignment, China entry and exit.
-- The travel_groups row stays the single source of truth; group_events keeps
-- the timeline and notifications fan out to company, partner and visa team.

-- Workflow + flight details + ground operations on the group itself
alter table public.travel_groups
  add column if not exists workflow_status text check (workflow_status is null or workflow_status in (
    'draft', 'submitted', 'correction_requested', 'rejected', 'company_approved', 'visa_processing', 'visa_issued', 'visa_approved',
    'guide_assigned', 'travelling_to_china', 'entry_evidence_uploaded', 'travelling_in_china', 'china_exited', 'completed')),
  add column if not exists workflow_updated_at timestamptz,
  add column if not exists submitted_by_partner boolean not null default false,
  add column if not exists submitted_at timestamptz,
  add column if not exists arrival_flight_date date,
  add column if not exists arrival_flight_time time,
  add column if not exists arrival_flight_no text,
  add column if not exists departure_flight_date date,
  add column if not exists departure_flight_time time,
  add column if not exists departure_flight_no text,
  add column if not exists other_border_requested boolean not null default false,
  add column if not exists other_border_note text,
  add column if not exists company_decision_note text,
  add column if not exists company_approved_at timestamptz,
  add column if not exists company_approved_by uuid references public.profiles(id),
  add column if not exists visa_processing_started_at timestamptz,
  add column if not exists visa_issued_at timestamptz,
  add column if not exists visa_approved_at timestamptz,
  add column if not exists visa_approved_by uuid references public.profiles(id),
  add column if not exists visa_emailed_at timestamptz,
  add column if not exists guide_id uuid,
  add column if not exists guide_phone text,
  add column if not exists guide_notes text,
  add column if not exists destination text,
  add column if not exists vehicle_notes text,
  add column if not exists stamped_visa_path text,
  add column if not exists stamped_visa_file_name text,
  add column if not exists stamped_visa_uploaded_at timestamptz,
  add column if not exists stamped_visa_uploaded_by text,
  add column if not exists stamped_visa_shared boolean not null default false,
  add column if not exists china_entry_at timestamptz,
  add column if not exists china_entry_confirmed_by text,
  add column if not exists china_exit_at timestamptz,
  add column if not exists china_exit_confirmed_by text,
  add column if not exists completed_at timestamptz;
create index if not exists travel_groups_workflow_idx on public.travel_groups (workflow_status) where workflow_status is not null;

-- B2B partner portal access (key shown once; only the hash is stored)
alter table public.b2b_partners
  add column if not exists portal_key_hash text unique,
  add column if not exists portal_active boolean not null default false,
  add column if not exists portal_last_seen_at timestamptz;

-- Guide / staff master (ground operations)
create table if not exists public.guides (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  role text not null default 'guide',
  languages text,
  notes text,
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.travel_groups add constraint travel_groups_guide_id_fkey foreign key (guide_id) references public.guides(id) on delete set null;

-- China Visa Team members (visa processing staff, team leader, ground/guide staff)
create table if not exists public.visa_team_members (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  role text not null default 'visa_processor' check (role in ('visa_processor', 'team_leader', 'ground_guide')),
  phone text,
  guide_id uuid references public.guides(id) on delete set null,
  access_key_hash text not null unique,
  active boolean not null default true,
  last_seen_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index if not exists visa_team_members_code_key on public.visa_team_members (upper(code));

-- Timeline of everything that happened to a group, by whom
create table if not exists public.group_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.travel_groups(id) on delete cascade,
  at timestamptz not null default now(),
  actor_kind text not null check (actor_kind in ('company', 'partner', 'visa_team', 'guide', 'system')),
  actor_name text,
  event text not null,
  status text,
  note text
);
create index if not exists group_events_group_idx on public.group_events (group_id, at desc);

-- Notifications for company staff, a partner (by code) or the visa team
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('company', 'partner', 'visa_team')),
  partner_code text,
  group_id uuid references public.travel_groups(id) on delete cascade,
  title text not null,
  body text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  email_to text,
  email_status text check (email_status is null or email_status in ('skipped', 'sent', 'failed')),
  email_error text
);
create index if not exists notifications_audience_idx on public.notifications (audience, partner_code, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (audience, partner_code) where read_at is null;

create trigger guides_set_updated_at before update on public.guides for each row execute function public.set_updated_at();
create trigger visa_team_members_set_updated_at before update on public.visa_team_members for each row execute function public.set_updated_at();

alter table public.guides enable row level security;
create policy "authenticated full access" on public.guides for all to authenticated using (true) with check (true);
create policy "anon denied" on public.guides for all to anon using (false) with check (false);
alter table public.visa_team_members enable row level security;
create policy "authenticated full access" on public.visa_team_members for all to authenticated using (true) with check (true);
create policy "anon denied" on public.visa_team_members for all to anon using (false) with check (false);
alter table public.group_events enable row level security;
create policy "authenticated full access" on public.group_events for all to authenticated using (true) with check (true);
create policy "anon denied" on public.group_events for all to anon using (false) with check (false);
alter table public.notifications enable row level security;
create policy "authenticated full access" on public.notifications for all to authenticated using (true) with check (true);
create policy "anon denied" on public.notifications for all to anon using (false) with check (false);

-- Partner-submitted groups are created by the server (service role), so the
-- B2B creation RPC must also be callable without a staff session.
grant execute on function public.create_b2b_group(jsonb) to service_role;
grant execute on function public.next_group_code(date) to service_role;
