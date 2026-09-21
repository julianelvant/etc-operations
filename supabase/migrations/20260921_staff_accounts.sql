-- staff_accounts: admin-managed desk/admin logins
create table if not exists public.staff_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  display_name text not null default '',
  password_hash text not null,
  role text not null check (role in ('desk', 'admin')),
  active boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_accounts_username_unique unique (username)
);

create index if not exists staff_accounts_active_idx on public.staff_accounts (active);
create index if not exists staff_accounts_role_idx on public.staff_accounts (role);

alter table public.staff_accounts enable row level security;

drop policy if exists staff_accounts_all on public.staff_accounts;
create policy staff_accounts_all on public.staff_accounts
  for all using (true) with check (true);
