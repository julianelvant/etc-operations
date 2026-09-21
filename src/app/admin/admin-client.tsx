"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { StudentVisitRow, TutorAttendanceRow, TutorRow } from "@/lib/attendance";
import type { DeskSessionRow } from "@/lib/auth/desk-sessions";
import {
  enrichShiftsWithAttendance,
  formatClock,
  formatDurationMinutes,
  getMergedShiftsForDay,
} from "@/lib/schedule";
import { formatShiftRange } from "@/lib/shift-time";
import { DayCalendar } from "@/app/desk/day-calendar";
import type { SlotMap, WeekDay } from "@/app/desk/desk-types";

type AttendanceAdmin = TutorAttendanceRow & { created_by?: string };
type VisitAdmin = StudentVisitRow & { created_by?: string };

type Props = {
  date: string;
  today: string;
  dayKey: string;
  isToday: boolean;
  slots: SlotMap;
  week: WeekDay[];
  tutors: TutorRow[];
  attendance: AttendanceAdmin[];
  visits: VisitAdmin[];
  activeSessions: DeskSessionRow[];
  sessionHistory: DeskSessionRow[];
};

function fmtWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Beirut",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

function durationLabel(start: string, end: string | null) {
  if (!end) return "open";
  const mins = Math.max(
    0,
    Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000),
  );
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function AdminClient({
  date,
  today,
  slots,
  week,
  tutors,
  attendance,
  visits,
  activeSessions,
  sessionHistory,
}: Props) {
  const router = useRouter();

  const nameToTutor = useMemo(() => {
    const map = new Map<string, TutorRow>();
    for (const t of tutors) map.set(t.name.toLowerCase(), t);
    return map;
  }, [tutors]);

  const dayShifts = useMemo(() => {
    const roster = getMergedShiftsForDay(slots);
    return enrichShiftsWithAttendance(
      roster,
      attendance.map((row) => ({
        tutorName: row.tutors?.name ?? "",
        scheduledShift: row.scheduled_shift,
        courses: row.tutors?.courses ?? [],
      })),
    );
  }, [slots, attendance]);
  const checkedInIds = useMemo(
    () => new Set(attendance.filter((a) => !a.time_out).map((a) => a.tutor_id)),
    [attendance],
  );

  const openCount = attendance.filter((a) => !a.time_out).length;
  const doneCount = attendance.filter((a) => a.time_out).length;

  return (
    <div className="space-y-8">
      {/* Hero strip */}
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800/70">
            Command view
          </p>
          <h1 className="font-display mt-1 text-3xl font-semibold text-slate-900 sm:text-4xl">
            Everyone&apos;s day
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
            Shifts, check-ins, check-outs, and who signed into the desk —
            one place for ops oversight.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => router.push(`/admin?date=${today}`)}
            className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold ${
              date === today
                ? "bg-emerald-800 text-white"
                : "border border-slate-200 bg-white text-slate-700"
            }`}
          >
            Today
          </button>
          <label className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-sm text-slate-700">
            <span className="text-slate-400">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => router.push(`/admin?date=${e.target.value}`)}
              className="border-0 bg-transparent py-2 outline-none"
            />
          </label>
        </div>
      </section>

      {/* Presence */}
      <section className="rounded-3xl border border-emerald-900/10 bg-white/80 p-5 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Active now
          </h2>
          <p className="text-sm tabular-nums text-slate-500">
            {activeSessions.length} session
            {activeSessions.length === 1 ? "" : "s"}
          </p>
        </div>
        {activeSessions.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No desk or admin accounts currently active.
          </p>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-2">
            {activeSessions.map((s) => (
              <li
                key={s.id}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-950"
              >
                <span
                  className="h-2 w-2 rounded-full bg-emerald-500"
                  aria-hidden
                />
                <span className="font-semibold">{s.username}</span>
                <span className="text-emerald-800/70">{s.role}</span>
                <span className="text-xs text-emerald-800/60">
                  seen {fmtWhen(s.last_seen_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Stats + week */}
      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Checked in (open)" value={String(openCount)} />
        <Stat label="Checked out" value={String(doneCount)} />
        <Stat label="Student visits" value={String(visits.length)} />
      </section>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {week.map((d) => (
          <Link
            key={d.date}
            href={`/admin?date=${d.date}`}
            className={`flex min-w-[3.5rem] flex-col items-center rounded-2xl px-2 py-2 text-center ${
              d.date === date
                ? "bg-emerald-800 text-white"
                : "bg-white/70 text-slate-700 ring-1 ring-slate-200"
            }`}
          >
            <span className="text-[10px] font-semibold uppercase opacity-80">
              {d.label}
            </span>
            <span className="font-display text-lg font-semibold">{d.dayNum}</span>
          </Link>
        ))}
      </div>

      {/* Calendar */}
      <DayCalendar
        shifts={dayShifts}
        attendance={attendance}
        nameToTutor={nameToTutor}
        checkedInIds={checkedInIds}
        isToday={false}
        readOnly
      />

      {/* Tables */}
      <section className="grid gap-8 lg:grid-cols-2">
        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Tutor check-ins
            </h2>
            <p className="text-sm text-slate-500">
              Including who recorded each row
            </p>
          </div>
          <div className="max-h-[28rem] overflow-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Tutor</th>
                  <th className="px-4 py-3 font-semibold">Shift</th>
                  <th className="px-4 py-3 font-semibold">In / Out</th>
                  <th className="px-4 py-3 font-semibold">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attendance.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No tutor attendance this day.
                    </td>
                  </tr>
                ) : (
                  attendance.map((row) => (
                    <tr key={row.id} className="align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">
                          {row.tutors?.name ?? "—"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {row.role}
                          {row.notes ? ` · ${row.notes}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {row.scheduled_shift
                          ? formatShiftRange(row.scheduled_shift)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-700">
                        {formatClock(row.time_in)}
                        <span className="text-slate-400"> → </span>
                        {row.time_out ? formatClock(row.time_out) : "open"}
                        {row.total_hours != null ? (
                          <span className="mt-0.5 block text-xs text-slate-400">
                            {row.total_hours}h
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {row.created_by || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Student visits
            </h2>
            <p className="text-sm text-slate-500">Tutoree log for this day</p>
          </div>
          <div className="max-h-[28rem] overflow-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Course</th>
                  <th className="px-4 py-3 font-semibold">In / Out</th>
                  <th className="px-4 py-3 font-semibold">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visits.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No student visits this day.
                    </td>
                  </tr>
                ) : (
                  visits.map((row) => (
                    <tr key={row.id} className="align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">
                          {row.student_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {row.tutors?.name
                            ? `helped by ${row.tutors.name}`
                            : "no helper"}
                          {row.notes ? ` · ${row.notes}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {row.course || "—"}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-700">
                        {formatClock(row.time_in)}
                        <span className="text-slate-400"> → </span>
                        {row.time_out ? formatClock(row.time_out) : "open"}
                        {row.duration_minutes != null ? (
                          <span className="mt-0.5 block text-xs text-slate-400">
                            {formatDurationMinutes(row.duration_minutes)}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {row.created_by || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Login history */}
      <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Login history
          </h2>
          <p className="text-sm text-slate-500">
            Desk and admin account sessions
          </p>
        </div>
        <div className="max-h-[22rem] overflow-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Account</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Logged in</th>
                <th className="px-4 py-3 font-semibold">Logged out</th>
                <th className="px-4 py-3 font-semibold">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessionHistory.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No sessions recorded yet.
                  </td>
                </tr>
              ) : (
                sessionHistory.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {s.username}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{s.role}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">
                      {fmtWhen(s.logged_in_at)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">
                      {s.logged_out_at ? fmtWhen(s.logged_out_at) : (
                        <span className="font-medium text-emerald-700">
                          active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-500">
                      {durationLabel(
                        s.logged_in_at,
                        s.logged_out_at ?? s.last_seen_at,
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white/80 px-5 py-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="font-display mt-1 text-3xl font-semibold tabular-nums text-slate-900">
        {value}
      </p>
    </div>
  );
}
