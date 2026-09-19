import { createClient } from "@/lib/supabase/server";

export type TutorRow = {
  id: string;
  name: string;
  courses: string[];
  active: boolean;
};

export type TutorAttendanceRow = {
  id: string;
  attendance_date: string;
  tutor_id: string;
  scheduled_shift: string;
  role: string;
  time_in: string;
  time_out: string | null;
  total_hours: number | null;
  notes: string;
  tutors?: { id: string; name: string; courses: string[] } | null;
};

export type StudentVisitRow = {
  id: string;
  visit_date: string;
  student_name: string;
  student_email: string;
  time_in: string;
  time_out: string | null;
  duration_minutes: number | null;
  course: string;
  tutor_id: string | null;
  notes: string;
  tutors?: { id: string; name: string } | null;
};

export async function listTutors(): Promise<TutorRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tutors")
    .select("id, name, courses, active")
    .eq("active", true)
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((t) => ({
    ...t,
    courses: Array.isArray(t.courses) ? t.courses : [],
  }));
}

export async function getAttendanceForDate(date: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tutor_attendance")
    .select(
      "id, attendance_date, tutor_id, scheduled_shift, role, time_in, time_out, total_hours, notes, tutors(id, name, courses)",
    )
    .eq("attendance_date", date)
    .order("time_in", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const tutors = Array.isArray(row.tutors) ? row.tutors[0] : row.tutors;
    return { ...row, tutors: tutors ?? null } as TutorAttendanceRow;
  });
}

export async function getVisitsForDate(date: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("student_visits")
    .select(
      "id, visit_date, student_name, student_email, time_in, time_out, duration_minutes, course, tutor_id, notes, tutors(id, name)",
    )
    .eq("visit_date", date)
    .order("time_in", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const tutors = Array.isArray(row.tutors) ? row.tutors[0] : row.tutors;
    return { ...row, tutors: tutors ?? null } as StudentVisitRow;
  });
}
