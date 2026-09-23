-- Attendance durability: audit log, snapshots, unique constraints, RLS lockdown.
-- Canonical companion to live schema (tutors / tutor_attendance / student_visits / desk_sessions).

-- ---------------------------------------------------------------------------
-- Append-only audit log
-- ---------------------------------------------------------------------------
create table if not exists public.attendance_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor text not null default '',
  entity text not null check (entity in (
    'tutor_attendance',
    'student_visits',
    'tutors',
    'staff_accounts',
    'desk_sessions',
    'system'
  )),
  entity_id text not null default '',
  action text not null check (action in (
    'insert',
    'update',
    'checkout',
    'set_times',
    'import',
    'restore',
    'wipe',
    'backup',
    'deactivate'
  )),
  before jsonb,
  after jsonb
);

create index if not exists attendance_events_occurred_at_idx
  on public.attendance_events (occurred_at desc);
create index if not exists attendance_events_entity_idx
  on public.attendance_events (entity, entity_id);

alter table public.attendance_events enable row level security;

-- ---------------------------------------------------------------------------
-- Durable snapshots (primary restore source; Storage is optional mirror)
-- ---------------------------------------------------------------------------
create table if not exists public.data_snapshots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  label text not null default '',
  reason text not null default 'manual',
  created_by text not null default 'system',
  counts jsonb not null default '{}'::jsonb,
  payload jsonb not null,
  storage_path text
);

create index if not exists data_snapshots_created_at_idx
  on public.data_snapshots (created_at desc);

alter table public.data_snapshots enable row level security;

-- ---------------------------------------------------------------------------
-- Uniqueness to prevent duplicate check-ins / visits under race
-- ---------------------------------------------------------------------------
create unique index if not exists tutor_attendance_date_tutor_time_uidx
  on public.tutor_attendance (attendance_date, tutor_id, time_in);

create unique index if not exists student_visits_date_name_time_uidx
  on public.student_visits (visit_date, lower(student_name), time_in);

-- ---------------------------------------------------------------------------
-- RLS: anon/authenticated may SELECT operational data for SSR; no writes.
-- All mutations go through the server service-role client (bypasses RLS).
-- ---------------------------------------------------------------------------
drop policy if exists tutors_all on public.tutors;
drop policy if exists tutor_attendance_all on public.tutor_attendance;
drop policy if exists student_visits_all on public.student_visits;
drop policy if exists desk_sessions_all on public.desk_sessions;
drop policy if exists staff_accounts_all on public.staff_accounts;

drop policy if exists tutors_select on public.tutors;
create policy tutors_select on public.tutors
  for select to anon, authenticated using (true);

drop policy if exists tutor_attendance_select on public.tutor_attendance;
create policy tutor_attendance_select on public.tutor_attendance
  for select to anon, authenticated using (true);

drop policy if exists student_visits_select on public.student_visits;
create policy student_visits_select on public.student_visits
  for select to anon, authenticated using (true);

drop policy if exists desk_sessions_select on public.desk_sessions;
create policy desk_sessions_select on public.desk_sessions
  for select to anon, authenticated using (true);

-- staff_accounts: no anon select (contains password hashes). Service role only.
drop policy if exists staff_accounts_select on public.staff_accounts;
-- intentionally no public select policy

-- audit + snapshots: no public access
drop policy if exists attendance_events_deny on public.attendance_events;
drop policy if exists data_snapshots_deny on public.data_snapshots;

-- Storage bucket for optional mirror (private)
insert into storage.buckets (id, name, public, file_size_limit)
values ('attendance-backups', 'attendance-backups', false, 52428800)
on conflict (id) do nothing;
