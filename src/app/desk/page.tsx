import { logoutAction } from "@/app/login/actions";
import { getSession } from "@/lib/auth/session";
import {
  getAttendanceForDate,
  getVisitsForDate,
  listTutors,
} from "@/lib/attendance";
import { getTodaySchedule } from "@/lib/schedule";
import { DeskClient } from "./desk-client";
import { redirect } from "next/navigation";

export default async function DeskPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { date, dayKey, slots } = getTodaySchedule();
  const [tutors, attendance, visits] = await Promise.all([
    listTutors(),
    getAttendanceForDate(date),
    getVisitsForDate(date),
  ]);

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-50 via-white to-emerald-50">
      <div className="border-b border-slate-200 bg-white/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <p className="text-sm text-slate-600">
            Signed in as <span className="font-medium">{session.username}</span>
          </p>
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Log out
            </button>
          </form>
        </div>
      </div>
      <DeskClient
        date={date}
        dayKey={dayKey}
        slots={slots}
        tutors={tutors}
        initialAttendance={attendance}
        initialVisits={visits}
      />
    </div>
  );
}
