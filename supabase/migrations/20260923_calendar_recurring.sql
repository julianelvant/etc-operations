-- Recurring calendar entries (admin-managed weekly shifts).

create table if not exists public.calendar_recurring (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  role text not null default 'Tutor'
    check (role in ('Tutor', 'TA', 'Coordinator', 'Other')),
  days text[] not null default '{}',
  start_time time not null,
  end_time time not null,
  courses jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_recurring_time_order check (end_time > start_time)
);

create index if not exists calendar_recurring_active_idx
  on public.calendar_recurring (active);

create index if not exists calendar_recurring_days_gin_idx
  on public.calendar_recurring using gin (days);

alter table public.calendar_recurring enable row level security;

-- No policies: anon/authenticated cannot read or write.
-- Server uses service-role client for all access.

create or replace function public.calendar_recurring_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists calendar_recurring_updated_at on public.calendar_recurring;
create trigger calendar_recurring_updated_at
  before update on public.calendar_recurring
  for each row execute function public.calendar_recurring_set_updated_at();
