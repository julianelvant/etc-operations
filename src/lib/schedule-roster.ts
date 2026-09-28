import type { SupabaseClient } from "@supabase/supabase-js";
import scheduleData from "@/data/schedule.json";
import type { ScheduledTutor, Schedule } from "@/lib/schedule";

export type ScheduleRosterRole = "Tutor" | "TA" | "Coordinator" | "Other";

export type ScheduleRosterRow = {
  id: string;
  weekday: string;
  time_slot: string;
  person_name: string;
  courses: string[];
  role: ScheduleRosterRole;
  sort_order: number;
  active: boolean;
};

export type ScheduleRosterInput = {
  weekday: string;
  time_slot: string;
  person_name: string;
  courses?: string[];
  role?: ScheduleRosterRole;
  sort_order?: number;
  active?: boolean;
};

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"];

function parseCourses(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((c) => String(c).trim()).filter(Boolean);
}

function mapRow(row: Record<string, unknown>): ScheduleRosterRow {
  return {
    id: String(row.id),
    weekday: String(row.weekday ?? "").toLowerCase(),
    time_slot: String(row.time_slot ?? ""),
    person_name: String(row.person_name ?? ""),
    courses: parseCourses(row.courses),
    role: (String(row.role ?? "Tutor") as ScheduleRosterRole) || "Tutor",
    sort_order: Number(row.sort_order ?? 0),
    active: Boolean(row.active ?? true),
  };
}

export function rosterToSlots(
  rows: ScheduleRosterRow[],
): Record<string, Record<string, ScheduledTutor[]>> {
  const days: Record<string, Record<string, ScheduledTutor[]>> = {};
  for (const day of WEEKDAYS) {
    days[day] = {};
  }

  const sorted = [...rows]
    .filter((r) => r.active)
    .sort(
      (a, b) =>
        a.weekday.localeCompare(b.weekday) ||
        a.time_slot.localeCompare(b.time_slot) ||
        a.sort_order - b.sort_order ||
        a.person_name.localeCompare(b.person_name),
    );

  for (const row of sorted) {
    const day = days[row.weekday] ?? {};
    const list = day[row.time_slot] ?? [];
    list.push({
      name: row.person_name,
      courses: [...row.courses],
      role: row.role,
    });
    day[row.time_slot] = list;
    days[row.weekday] = day;
  }

  return days;
}

export function collectTimeSlots(
  days: Record<string, Record<string, ScheduledTutor[]>>,
): string[] {
  const slots = new Set<string>();
  for (const day of WEEKDAYS) {
    for (const slot of Object.keys(days[day] ?? {})) {
      slots.add(slot);
    }
  }
  return Array.from(slots).sort((a, b) => {
    const [aStart] = a.split("-");
    const [bStart] = b.split("-");
    return aStart.localeCompare(bStart) || a.localeCompare(b);
  });
}

export async function countScheduleRoster(
  supabase: SupabaseClient,
): Promise<number> {
  const { count, error } = await supabase
    .from("schedule_roster")
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function seedScheduleRosterFromJson(
  supabase: SupabaseClient,
): Promise<number> {
  const schedule = scheduleData as Schedule;
  const inserts: Record<string, unknown>[] = [];
  let order = 0;

  for (const weekday of WEEKDAYS) {
    const slots = schedule.days[weekday] ?? {};
    for (const [time_slot, people] of Object.entries(slots)) {
      for (const person of people) {
        inserts.push({
          weekday,
          time_slot,
          person_name: person.name,
          courses: person.courses ?? [],
          role: person.role ?? "Tutor",
          sort_order: order++,
          active: true,
        });
      }
    }
  }

  if (inserts.length === 0) return 0;

  const { error } = await supabase.from("schedule_roster").insert(inserts);
  if (error) throw new Error(error.message);
  return inserts.length;
}

export async function ensureScheduleRosterSeeded(
  supabase: SupabaseClient,
): Promise<void> {
  const count = await countScheduleRoster(supabase);
  if (count > 0) return;
  await seedScheduleRosterFromJson(supabase);
}

export async function listScheduleRoster(
  supabase: SupabaseClient,
  opts?: { activeOnly?: boolean },
): Promise<ScheduleRosterRow[]> {
  let q = supabase
    .from("schedule_roster")
    .select("*")
    .order("weekday")
    .order("time_slot")
    .order("sort_order")
    .order("person_name");

  if (opts?.activeOnly) {
    q = q.eq("active", true);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function loadScheduleDays(
  supabase: SupabaseClient,
): Promise<Record<string, Record<string, ScheduledTutor[]>>> {
  await ensureScheduleRosterSeeded(supabase);
  const rows = await listScheduleRoster(supabase, { activeOnly: true });
  return rosterToSlots(rows);
}

export async function createScheduleRosterEntry(
  supabase: SupabaseClient,
  input: ScheduleRosterInput,
): Promise<ScheduleRosterRow> {
  const { data, error } = await supabase
    .from("schedule_roster")
    .insert({
      weekday: input.weekday.toLowerCase(),
      time_slot: input.time_slot.trim(),
      person_name: input.person_name.trim(),
      courses: input.courses ?? [],
      role: input.role ?? "Tutor",
      sort_order: input.sort_order ?? 0,
      active: input.active ?? true,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}

export async function updateScheduleRosterEntry(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<ScheduleRosterInput>,
): Promise<ScheduleRosterRow> {
  const body: Record<string, unknown> = {};
  if (patch.weekday !== undefined) body.weekday = patch.weekday.toLowerCase();
  if (patch.time_slot !== undefined) body.time_slot = patch.time_slot.trim();
  if (patch.person_name !== undefined) {
    body.person_name = patch.person_name.trim();
  }
  if (patch.courses !== undefined) body.courses = patch.courses;
  if (patch.role !== undefined) body.role = patch.role;
  if (patch.sort_order !== undefined) body.sort_order = patch.sort_order;
  if (patch.active !== undefined) body.active = patch.active;

  const { data, error } = await supabase
    .from("schedule_roster")
    .update(body)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}

export async function deleteScheduleRosterEntry(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("schedule_roster")
    .update({ active: false })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
