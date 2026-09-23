import type { SupabaseClient } from "@supabase/supabase-js";

export type CalendarRecurringRole = "Tutor" | "TA" | "Coordinator" | "Other";

export type CalendarRecurringRow = {
  id: string;
  display_name: string;
  role: CalendarRecurringRole;
  days: string[];
  start_time: string;
  end_time: string;
  courses: string[];
  active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
};

export const WEEKDAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

function parseCourses(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((c) => String(c).trim()).filter(Boolean);
}

function mapRow(row: Record<string, unknown>): CalendarRecurringRow {
  return {
    id: String(row.id),
    display_name: String(row.display_name ?? ""),
    role: (String(row.role ?? "Tutor") as CalendarRecurringRole) || "Tutor",
    days: Array.isArray(row.days)
      ? row.days.map((d) => String(d).toLowerCase())
      : [],
    start_time: String(row.start_time ?? "").slice(0, 5),
    end_time: String(row.end_time ?? "").slice(0, 5),
    courses: parseCourses(row.courses),
    active: Boolean(row.active),
    notes: String(row.notes ?? ""),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export async function listCalendarRecurring(
  supabase: SupabaseClient,
  opts?: { activeOnly?: boolean },
): Promise<CalendarRecurringRow[]> {
  let q = supabase
    .from("calendar_recurring")
    .select("*")
    .order("display_name", { ascending: true });

  if (opts?.activeOnly) {
    q = q.eq("active", true);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function listRecurringForDay(
  supabase: SupabaseClient,
  dayKey: string,
): Promise<CalendarRecurringRow[]> {
  const rows = await listCalendarRecurring(supabase, { activeOnly: true });
  const key = dayKey.toLowerCase();
  return rows.filter((r) => r.days.includes(key));
}

export type CalendarRecurringInput = {
  display_name: string;
  role: CalendarRecurringRole;
  days: string[];
  start_time: string;
  end_time: string;
  courses?: string[];
  notes?: string;
  active?: boolean;
};

export async function createCalendarRecurring(
  supabase: SupabaseClient,
  input: CalendarRecurringInput,
): Promise<CalendarRecurringRow> {
  const { data, error } = await supabase
    .from("calendar_recurring")
    .insert({
      display_name: input.display_name.trim(),
      role: input.role,
      days: input.days.map((d) => d.toLowerCase()),
      start_time: input.start_time,
      end_time: input.end_time,
      courses: input.courses ?? [],
      notes: input.notes?.trim() ?? "",
      active: input.active ?? true,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}

export async function updateCalendarRecurring(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<CalendarRecurringInput>,
): Promise<CalendarRecurringRow> {
  const body: Record<string, unknown> = {};
  if (patch.display_name !== undefined) {
    body.display_name = patch.display_name.trim();
  }
  if (patch.role !== undefined) body.role = patch.role;
  if (patch.days !== undefined) {
    body.days = patch.days.map((d) => d.toLowerCase());
  }
  if (patch.start_time !== undefined) body.start_time = patch.start_time;
  if (patch.end_time !== undefined) body.end_time = patch.end_time;
  if (patch.courses !== undefined) body.courses = patch.courses;
  if (patch.notes !== undefined) body.notes = patch.notes.trim();
  if (patch.active !== undefined) body.active = patch.active;

  const { data, error } = await supabase
    .from("calendar_recurring")
    .update(body)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}

export async function deactivateCalendarRecurring(
  supabase: SupabaseClient,
  id: string,
): Promise<CalendarRecurringRow> {
  return updateCalendarRecurring(supabase, id, { active: false });
}
