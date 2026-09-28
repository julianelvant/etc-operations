-- Weekly roster slots (editable replacement for schedule.json on the desk).

create table if not exists public.schedule_roster (
  id uuid primary key default gen_random_uuid(),
  weekday text not null
    check (weekday in ('monday', 'tuesday', 'wednesday', 'thursday', 'friday')),
  time_slot text not null,
  person_name text not null,
  courses jsonb not null default '[]'::jsonb,
  role text not null default 'Tutor'
    check (role in ('Tutor', 'TA', 'Coordinator', 'Other')),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists schedule_roster_weekday_slot_idx
  on public.schedule_roster (weekday, time_slot)
  where active = true;

alter table public.schedule_roster enable row level security;

create or replace function public.schedule_roster_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists schedule_roster_updated_at on public.schedule_roster;
create trigger schedule_roster_updated_at
  before update on public.schedule_roster
  for each row execute function public.schedule_roster_set_updated_at();
