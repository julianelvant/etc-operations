import type { SupabaseClient } from "@supabase/supabase-js";
import { isoToBeirutTime } from "@/lib/beirut-datetime";

export type TutorSheetRow = {
  id: string;
  date: string;
  tutorName: string;
  tutorId: string;
  scheduledShift: string;
  role: string;
  timeIn: string;
  timeOut: string;
  totalHours: number | null;
  notes: string;
};

export type VisitSheetRow = {
  id: string;
  date: string;
  studentName: string;
  studentEmail: string;
  timeIn: string;
  timeOut: string;
  durationMinutes: number | null;
  course: string;
  tutorName: string;
  tutorId: string | null;
  notes: string;
};

function tutorNameFromJoin(
  tutors: { name?: string } | { name?: string }[] | null | undefined,
): string {
  if (!tutors) return "";
  const t = Array.isArray(tutors) ? tutors[0] : tutors;
  return t?.name ?? "";
}

export async function fetchEditorData(
  supabase: SupabaseClient,
  from: string,
  to: string,
): Promise<{ tutors: TutorSheetRow[]; visits: VisitSheetRow[] }> {
  const [attRes, visRes] = await Promise.all([
    supabase
      .from("tutor_attendance")
      .select(
        "id, attendance_date, tutor_id, scheduled_shift, role, time_in, time_out, total_hours, notes, tutors(id, name)",
      )
      .gte("attendance_date", from)
      .lte("attendance_date", to)
      .order("attendance_date")
      .order("time_in"),
    supabase
      .from("student_visits")
      .select(
        "id, visit_date, student_name, student_email, time_in, time_out, duration_minutes, course, tutor_id, notes, tutors(id, name)",
      )
      .gte("visit_date", from)
      .lte("visit_date", to)
      .order("visit_date")
      .order("time_in"),
  ]);

  if (attRes.error) throw new Error(attRes.error.message);
  if (visRes.error) throw new Error(visRes.error.message);

  const tutors: TutorSheetRow[] = (attRes.data ?? []).map((row) => ({
    id: row.id,
    date: row.attendance_date,
    tutorId: row.tutor_id,
    tutorName: tutorNameFromJoin(row.tutors),
    scheduledShift: row.scheduled_shift ?? "",
    role: row.role ?? "Tutor",
    timeIn: isoToBeirutTime(row.time_in),
    timeOut: isoToBeirutTime(row.time_out),
    totalHours: row.total_hours,
    notes: row.notes ?? "",
  }));

  const visits: VisitSheetRow[] = (visRes.data ?? []).map((row) => ({
    id: row.id,
    date: row.visit_date,
    studentName: row.student_name,
    studentEmail: row.student_email ?? "",
    timeIn: isoToBeirutTime(row.time_in),
    timeOut: isoToBeirutTime(row.time_out),
    durationMinutes: row.duration_minutes,
    course: row.course ?? "",
    tutorId: row.tutor_id,
    tutorName: tutorNameFromJoin(row.tutors),
    notes: row.notes ?? "",
  }));

  return { tutors, visits };
}

export async function resolveTutorIdByName(
  supabase: SupabaseClient,
  name: string,
): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const { data } = await supabase
    .from("tutors")
    .select("id, name")
    .ilike("name", trimmed)
    .limit(5);
  const exact = (data ?? []).find(
    (t) => t.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (exact) return exact.id;
  if (data?.length === 1) return data[0].id;
  return null;
}
