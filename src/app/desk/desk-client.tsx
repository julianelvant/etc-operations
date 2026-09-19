"use client";

import { useMemo, useState, useTransition } from "react";
import type { TutorAttendanceRow, TutorRow, StudentVisitRow } from "@/lib/attendance";
import {
  formatClock,
  formatDurationMinutes,
  slotLabel,
} from "@/lib/schedule";

type SlotMap = Record<string, { name: string; courses: string[] }[]>;

type Props = {
  date: string;
  dayKey: string;
  slots: SlotMap;
  tutors: TutorRow[];
  initialAttendance: TutorAttendanceRow[];
  initialVisits: StudentVisitRow[];
};

export function DeskClient({
  date,
  dayKey,
  slots,
  tutors,
  initialAttendance,
  initialVisits,
}: Props) {
  const [attendance, setAttendance] = useState(initialAttendance);
  const [visits, setVisits] = useState(initialVisits);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Student form
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [course, setCourse] = useState("");
  const [tutorId, setTutorId] = useState("");
  const [studentNotes, setStudentNotes] = useState("");

  const checkedInIds = useMemo(
    () => new Set(attendance.filter((a) => !a.time_out).map((a) => a.tutor_id)),
    [attendance],
  );

  const nameToTutor = useMemo(() => {
    const map = new Map<string, TutorRow>();
    for (const t of tutors) map.set(t.name.toLowerCase(), t);
    return map;
  }, [tutors]);

  const sortedSlots = Object.keys(slots).sort();

  async function api(path: string, body: unknown) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Request failed");
    return json;
  }

  function flash(ok: string) {
    setError(null);
    setMessage(ok);
    setTimeout(() => setMessage(null), 2500);
  }

  function checkInTutor(tutor: TutorRow, scheduledShift?: string) {
    startTransition(async () => {
      try {
        const { row } = await api("/api/attendance/tutors", {
          action: "check_in",
          tutorId: tutor.id,
          scheduledShift: scheduledShift ?? "",
        });
        setAttendance((prev) => [...prev, row]);
        flash(`${tutor.name} checked in`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Check-in failed");
      }
    });
  }

  function checkOutTutor(id: string) {
    startTransition(async () => {
      try {
        const { row } = await api("/api/attendance/tutors", {
          action: "check_out",
          id,
        });
        setAttendance((prev) => prev.map((r) => (r.id === id ? row : r)));
        flash("Tutor checked out");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Check-out failed");
      }
    });
  }

  function addStudent(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const { row } = await api("/api/attendance/students", {
          action: "check_in",
          studentName,
          studentEmail,
          course,
          tutorId: tutorId || null,
          notes: studentNotes,
        });
        setVisits((prev) => [...prev, row]);
        setStudentName("");
        setStudentEmail("");
        setCourse("");
        setStudentNotes("");
        flash("Student visit logged");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add student");
      }
    });
  }

  function checkOutStudent(id: string) {
    startTransition(async () => {
      try {
        const { row } = await api("/api/attendance/students", {
          action: "check_out",
          id,
        });
        setVisits((prev) => prev.map((r) => (r.id === id ? row : r)));
        flash("Student checked out");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Check-out failed");
      }
    });
  }

  const openTutors = attendance.filter((a) => !a.time_out);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-6 py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700">
            ETC Attendance Desk
          </p>
          <h1 className="mt-1 font-display text-4xl font-semibold text-slate-900">
            Today
          </h1>
          <p className="mt-1 text-slate-600">
            {date} · {dayKey.charAt(0).toUpperCase() + dayKey.slice(1)} (Beirut)
          </p>
        </div>
        <a
          href="/desk/export"
          className="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Export Excel
        </a>
      </header>

      {(message || error) && (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            error
              ? "bg-rose-50 text-rose-700"
              : "bg-emerald-50 text-emerald-800"
          }`}
        >
          {error ?? message}
        </div>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Scheduled tutors
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Tap Check in — shift and details fill automatically from the schedule.
        </p>

        {sortedSlots.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">
            No tutoring scheduled today (weekend or empty day).
          </p>
        ) : (
          <div className="mt-6 space-y-6">
            {sortedSlots.map((slot) => (
              <div key={slot}>
                <h3 className="mb-3 text-sm font-medium text-emerald-700">
                  {slotLabel(slot)}
                </h3>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {slots[slot].map((entry) => {
                    const tutor = nameToTutor.get(entry.name.toLowerCase());
                    const isIn = tutor ? checkedInIds.has(tutor.id) : false;
                    return (
                      <li
                        key={`${slot}-${entry.name}`}
                        className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                      >
                        <div>
                          <p className="font-medium text-slate-900">
                            {entry.name}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {entry.courses.join(", ")}
                          </p>
                        </div>
                        {tutor ? (
                          <button
                            type="button"
                            disabled={pending || isIn}
                            onClick={() => checkInTutor(tutor, slot)}
                            className="shrink-0 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-slate-300"
                          >
                            {isIn ? "In" : "Check in"}
                          </button>
                        ) : (
                          <span className="text-xs text-amber-600">
                            Not in DB
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 border-t border-slate-100 pt-6">
          <h3 className="text-sm font-medium text-slate-700">
            Check in someone not on today&apos;s schedule
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {tutors
              .filter((t) => !checkedInIds.has(t.id))
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={pending}
                  onClick={() => checkInTutor(t)}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-emerald-400 hover:text-emerald-700"
                >
                  {t.name}
                </button>
              ))}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Checked in</h2>
        {attendance.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No tutors checked in yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {attendance.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {row.tutors?.name ?? "Tutor"}
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      {row.role} · {row.scheduled_shift || "—"}
                    </span>
                  </p>
                  <p className="text-sm text-slate-500">
                    In {formatClock(row.time_in)}
                    {row.time_out
                      ? ` → Out ${formatClock(row.time_out)} (${row.total_hours ?? "—"} hrs)`
                      : " · still in"}
                  </p>
                </div>
                {!row.time_out ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => checkOutTutor(row.id)}
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Check out
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Add student</h2>
        <p className="mt-1 text-sm text-slate-500">
          Link the visit to a checked-in tutor when possible.
        </p>
        <form onSubmit={addStudent} className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-1">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Student name
            </span>
            <input
              required
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Student email
            </span>
            <input
              type="email"
              value={studentEmail}
              onChange={(e) => setStudentEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Tutor who helped
            </span>
            <select
              value={tutorId}
              onChange={(e) => {
                setTutorId(e.target.value);
                const t = tutors.find((x) => x.id === e.target.value);
                if (t?.courses?.[0] && !course) setCourse(t.courses[0]);
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">— Select —</option>
              {openTutors.map((a) => (
                <option key={a.id} value={a.tutor_id}>
                  {a.tutors?.name ?? a.tutor_id} (in)
                </option>
              ))}
              {tutors
                .filter((t) => !openTutors.some((a) => a.tutor_id === t.id))
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Course
            </span>
            <input
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              list="course-options"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <datalist id="course-options">
              {Array.from(
                new Set(tutors.flatMap((t) => t.courses)),
              ).map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Notes
            </span>
            <input
              value={studentNotes}
              onChange={(e) => setStudentNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="sm:col-span-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            Log student visit
          </button>
        </form>

        <h3 className="mt-10 text-base font-semibold text-slate-900">
          Students today
        </h3>
        {visits.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No student visits yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {visits.map((v) => (
              <li
                key={v.id}
                className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {v.student_name}
                    {v.course ? (
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        {v.course}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm text-slate-500">
                    {v.tutors?.name ? `with ${v.tutors.name} · ` : ""}
                    In {formatClock(v.time_in)}
                    {v.time_out
                      ? ` → Out ${formatClock(v.time_out)} (${formatDurationMinutes(v.duration_minutes)})`
                      : " · still in"}
                  </p>
                </div>
                {!v.time_out ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => checkOutStudent(v.id)}
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Check out
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
