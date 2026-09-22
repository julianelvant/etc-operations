import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import {
  listActiveSessions,
  listSessionHistory,
} from "@/lib/auth/desk-sessions";
import {
  getAttendanceForDate,
  getVisitsForDate,
  listTutors,
} from "@/lib/attendance";
import { getBeirutParts, getScheduleForDate, getWeekDates } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";
import { AdminClient } from "./admin-client";

export const metadata: Metadata = {
  title: "Admin",
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/desk");

  const params = await searchParams;
  const today = getBeirutParts().date;
  const date =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : today;

  const { dayKey, slots, isToday } = getScheduleForDate(date);
  const week = getWeekDates(date);

  const supabase = await createClient();
  const [
    tutors,
    attendanceBase,
    visitsBase,
    activeSessions,
    sessionHistory,
    attWithCreator,
    visWithCreator,
  ] = await Promise.all([
    listTutors(),
    getAttendanceForDate(date),
    getVisitsForDate(date),
    listActiveSessions(),
    listSessionHistory(40),
    supabase
      .from("tutor_attendance")
      .select("id, created_by")
      .eq("attendance_date", date),
    supabase
      .from("student_visits")
      .select("id, created_by")
      .eq("visit_date", date),
  ]);

  const attCreator = new Map(
    (attWithCreator.data ?? []).map((r) => [r.id, r.created_by as string]),
  );
  const visCreator = new Map(
    (visWithCreator.data ?? []).map((r) => [r.id, r.created_by as string]),
  );

  const attendance = attendanceBase.map((r) => ({
    ...r,
    created_by: attCreator.get(r.id) ?? "",
  }));
  const visits = visitsBase.map((r) => ({
    ...r,
    created_by: visCreator.get(r.id) ?? "",
  }));

  return (
    <AdminClient
      date={date}
      today={today}
      dayKey={dayKey}
      isToday={isToday}
      slots={slots}
      week={week}
      tutors={tutors}
      attendance={attendance}
      visits={visits}
      activeSessions={activeSessions}
      sessionHistory={sessionHistory}
    />
  );
}
