-- Write policies (no DELETE) + security definer RPCs for audit/snapshots/restore/health.
-- Companion to 20260923_attendance_durability.sql (applied on remote as
-- attendance_write_policies_and_rpcs).

drop policy if exists tutors_insert on public.tutors;
create policy tutors_insert on public.tutors
  for insert to anon, authenticated with check (true);
drop policy if exists tutors_update on public.tutors;
create policy tutors_update on public.tutors
  for update to anon, authenticated using (true) with check (true);

drop policy if exists tutor_attendance_insert on public.tutor_attendance;
create policy tutor_attendance_insert on public.tutor_attendance
  for insert to anon, authenticated with check (true);
drop policy if exists tutor_attendance_update on public.tutor_attendance;
create policy tutor_attendance_update on public.tutor_attendance
  for update to anon, authenticated using (true) with check (true);

drop policy if exists student_visits_insert on public.student_visits;
create policy student_visits_insert on public.student_visits
  for insert to anon, authenticated with check (true);
drop policy if exists student_visits_update on public.student_visits;
create policy student_visits_update on public.student_visits
  for update to anon, authenticated using (true) with check (true);

drop policy if exists desk_sessions_insert on public.desk_sessions;
create policy desk_sessions_insert on public.desk_sessions
  for insert to anon, authenticated with check (true);
drop policy if exists desk_sessions_update on public.desk_sessions;
create policy desk_sessions_update on public.desk_sessions
  for update to anon, authenticated using (true) with check (true);

drop policy if exists staff_accounts_select on public.staff_accounts;
create policy staff_accounts_select on public.staff_accounts
  for select to anon, authenticated using (true);
drop policy if exists staff_accounts_insert on public.staff_accounts;
create policy staff_accounts_insert on public.staff_accounts
  for insert to anon, authenticated with check (true);
drop policy if exists staff_accounts_update on public.staff_accounts;
create policy staff_accounts_update on public.staff_accounts
  for update to anon, authenticated using (true) with check (true);

create or replace function public.log_attendance_event(
  p_actor text,
  p_entity text,
  p_entity_id text,
  p_action text,
  p_before jsonb default null,
  p_after jsonb default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into public.attendance_events (actor, entity, entity_id, action, before, after)
  values (
    coalesce(p_actor, ''),
    p_entity,
    coalesce(p_entity_id, ''),
    p_action,
    p_before,
    p_after
  )
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.log_attendance_event(text, text, text, text, jsonb, jsonb) from public;
grant execute on function public.log_attendance_event(text, text, text, text, jsonb, jsonb) to anon, authenticated;

create or replace function public.create_data_snapshot(
  p_label text,
  p_reason text,
  p_created_by text,
  p_counts jsonb,
  p_payload jsonb,
  p_storage_path text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into public.data_snapshots (label, reason, created_by, counts, payload, storage_path)
  values (
    coalesce(p_label, ''),
    coalesce(p_reason, 'manual'),
    coalesce(p_created_by, 'system'),
    coalesce(p_counts, '{}'::jsonb),
    p_payload,
    p_storage_path
  )
  returning id into new_id;

  perform public.log_attendance_event(
    coalesce(p_created_by, 'system'),
    'system',
    new_id::text,
    'backup',
    null,
    jsonb_build_object('counts', p_counts, 'label', p_label, 'reason', p_reason)
  );

  return new_id;
end;
$$;

revoke all on function public.create_data_snapshot(text, text, text, jsonb, jsonb, text) from public;
grant execute on function public.create_data_snapshot(text, text, text, jsonb, jsonb, text) to anon, authenticated;

create or replace function public.list_data_snapshots(p_limit int default 30)
returns table (
  id uuid,
  created_at timestamptz,
  label text,
  reason text,
  created_by text,
  counts jsonb,
  storage_path text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select s.id, s.created_at, s.label, s.reason, s.created_by, s.counts, s.storage_path
  from public.data_snapshots s
  order by s.created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
end;
$$;

revoke all on function public.list_data_snapshots(int) from public;
grant execute on function public.list_data_snapshots(int) to anon, authenticated;

create or replace function public.get_data_snapshot(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'id', s.id,
    'created_at', s.created_at,
    'label', s.label,
    'reason', s.reason,
    'created_by', s.created_by,
    'counts', s.counts,
    'payload', s.payload,
    'storage_path', s.storage_path
  ) into result
  from public.data_snapshots s
  where s.id = p_id;
  return result;
end;
$$;

revoke all on function public.get_data_snapshot(uuid) from public;
grant execute on function public.get_data_snapshot(uuid) to anon, authenticated;

create or replace function public.restore_attendance_from_snapshot(
  p_snapshot_id uuid,
  p_actor text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  snap jsonb;
  payload jsonb;
  att jsonb;
  vis jsonb;
  before_counts jsonb;
  inserted_att int := 0;
  inserted_vis int := 0;
begin
  snap := public.get_data_snapshot(p_snapshot_id);
  if snap is null then
    raise exception 'Snapshot not found';
  end if;
  payload := snap->'payload';
  att := coalesce(payload->'tutor_attendance', '[]'::jsonb);
  vis := coalesce(payload->'student_visits', '[]'::jsonb);

  before_counts := jsonb_build_object(
    'tutor_attendance', (select count(*) from public.tutor_attendance),
    'student_visits', (select count(*) from public.student_visits)
  );

  delete from public.tutor_attendance where true;
  delete from public.student_visits where true;

  insert into public.tutor_attendance
  select * from jsonb_populate_recordset(null::public.tutor_attendance, att);
  get diagnostics inserted_att = row_count;

  insert into public.student_visits
  select * from jsonb_populate_recordset(null::public.student_visits, vis);
  get diagnostics inserted_vis = row_count;

  perform public.log_attendance_event(
    coalesce(p_actor, 'system'),
    'system',
    p_snapshot_id::text,
    'restore',
    before_counts,
    jsonb_build_object('tutor_attendance', inserted_att, 'student_visits', inserted_vis)
  );

  return jsonb_build_object(
    'tutor_attendance', inserted_att,
    'student_visits', inserted_vis,
    'snapshot_id', p_snapshot_id
  );
end;
$$;

revoke all on function public.restore_attendance_from_snapshot(uuid, text) from public;
grant execute on function public.restore_attendance_from_snapshot(uuid, text) to anon, authenticated;

create or replace function public.data_health()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  last_backup timestamptz;
  last_backup_id uuid;
begin
  select s.created_at, s.id into last_backup, last_backup_id
  from public.data_snapshots s
  order by s.created_at desc
  limit 1;

  return jsonb_build_object(
    'tutor_attendance', (select count(*) from public.tutor_attendance),
    'student_visits', (select count(*) from public.student_visits),
    'tutors', (select count(*) from public.tutors),
    'staff_accounts', (select count(*) from public.staff_accounts),
    'desk_sessions', (select count(*) from public.desk_sessions),
    'attendance_events', (select count(*) from public.attendance_events),
    'snapshots', (select count(*) from public.data_snapshots),
    'last_backup_at', last_backup,
    'last_backup_id', last_backup_id,
    'anon_can_delete_attendance', false
  );
end;
$$;

revoke all on function public.data_health() from public;
grant execute on function public.data_health() to anon, authenticated;
