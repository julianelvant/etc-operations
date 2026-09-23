import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import {
  getAttendanceForDate,
  getVisitsForDate,
  listTutors,
} from "@/lib/attendance";
import { listRecurringForDay } from "@/lib/calendar-recurring";
import {
  getBeirutParts,
  getScheduleForDate,
  getWeekDates,
} from "@/lib/schedule";
import { createWriteClient } from "@/lib/supabase/write";
import { DeskClient } from "./desk-client";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Desk",
};

export default async function DeskPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const today = getBeirutParts().date;
  const date =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : today;

  const { dayKey, slots, isToday } = getScheduleForDate(date);
  const week = getWeekDates(date);

  const supabase = await createWriteClient();
  const [tutors, attendance, visits, recurring] = await Promise.all([
    listTutors(),
    getAttendanceForDate(date),
    getVisitsForDate(date),
    listRecurringForDay(supabase, dayKey),
  ]);

  return (
    <DeskClient
      date={date}
      today={today}
      dayKey={dayKey}
      isToday={isToday}
      slots={slots}
      recurring={recurring}
      week={week}
      tutors={tutors}
      initialAttendance={attendance}
      initialVisits={visits}
    />
  );
}
