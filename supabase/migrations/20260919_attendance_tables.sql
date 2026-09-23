-- Canonical DDL for attendance core tables (reproducible schema).
-- Applied historically as create_attendance_tables on the remote project.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.tutors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  courses jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.tutor_attendance (
  id uuid primary key default gen_random_uuid(),
  attendance_date date not null,
  tutor_id uuid not null references public.tutors (id) on delete restrict,
  scheduled_shift text not null default '',
  role text not null default 'Tutor',
  time_in timestamptz not null,
  time_out timestamptz,
  total_hours numeric(6, 2),
  notes text not null default '',
  created_by text not null default 'desk',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tutor_attendance_date_idx
  on public.tutor_attendance (attendance_date);
create index if not exists tutor_attendance_tutor_id_idx
  on public.tutor_attendance (tutor_id);

drop trigger if exists tutor_attendance_set_updated_at on public.tutor_attendance;
create trigger tutor_attendance_set_updated_at
  before update on public.tutor_attendance
  for each row execute function public.set_updated_at();

create table if not exists public.student_visits (
  id uuid primary key default gen_random_uuid(),
  visit_date date not null,
  student_name text not null,
  student_email text not null default '',
  time_in timestamptz not null,
  time_out timestamptz,
  duration_minutes integer,
  course text not null default '',
  tutor_id uuid references public.tutors (id) on delete set null,
  notes text not null default '',
  created_by text not null default 'desk',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_visits_date_idx
  on public.student_visits (visit_date);
create index if not exists student_visits_tutor_id_idx
  on public.student_visits (tutor_id);

drop trigger if exists student_visits_set_updated_at on public.student_visits;
create trigger student_visits_set_updated_at
  before update on public.student_visits
  for each row execute function public.set_updated_at();

create table if not exists public.desk_sessions (
  id uuid primary key,
  username text not null,
  role text not null check (role in ('desk', 'admin')),
  logged_in_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  logged_out_at timestamptz,
  user_agent text
);

alter table public.tutors enable row level security;
alter table public.tutor_attendance enable row level security;
alter table public.student_visits enable row level security;
alter table public.desk_sessions enable row level security;
