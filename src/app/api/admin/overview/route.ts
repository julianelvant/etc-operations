import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getBeirutParts, getScheduleForDate } from "@/lib/schedule";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const today = getBeirutParts().date;
  const dateParam = request.nextUrl.searchParams.get("date");
  const date =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;

  const supabase = await createClient();
  const [{ data: attendance, error: aErr }, { data: visits, error: vErr }, { data: tutors, error: tErr }] =
    await Promise.all([
      supabase
        .from("tutor_attendance")
        .select(
          "id, attendance_date, tutor_id, scheduled_shift, role, time_in, time_out, total_hours, notes, created_by, tutors(id, name, courses)",
        )
        .eq("attendance_date", date)
        .order("time_in", { ascending: true }),
      supabase
        .from("student_visits")
        .select(
          "id, visit_date, student_name, student_email, time_in, time_out, duration_minutes, course, tutor_id, notes, created_by, tutors(id, name)",
        )
        .eq("visit_date", date)
        .order("time_in", { ascending: true }),
      supabase
        .from("tutors")
        .select("id, name, courses, active")
        .eq("active", true)
        .order("name"),
    ]);

  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });
  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });

  const normAtt = (attendance ?? []).map((row) => {
    const tutorsJoin = Array.isArray(row.tutors) ? row.tutors[0] : row.tutors;
    return { ...row, tutors: tutorsJoin ?? null };
  });
  const normVis = (visits ?? []).map((row) => {
    const tutorsJoin = Array.isArray(row.tutors) ? row.tutors[0] : row.tutors;
    return { ...row, tutors: tutorsJoin ?? null };
  });

  const { dayKey, slots, isToday } = getScheduleForDate(date);

  return NextResponse.json({
    date,
    today,
    dayKey,
    isToday,
    slots,
    tutors: (tutors ?? []).map((t) => ({
      ...t,
      courses: Array.isArray(t.courses) ? t.courses : [],
    })),
    attendance: normAtt,
    visits: normVis,
  });
}
