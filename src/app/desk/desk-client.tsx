"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import type {
  StudentVisitRow,
  TutorAttendanceRow,
  TutorRow,
} from "@/lib/attendance";
import {
  TIMELINE_END_MIN,
  TIMELINE_PX_PER_MIN,
  TIMELINE_START_MIN,
  addDays,
  beirutMinutes,
  clockToMinutes,
  formatClock,
  formatDurationMinutes,
  slotLabel,
} from "@/lib/schedule";

type SlotMap = Record<string, { name: string; courses: string[] }[]>;
type WeekDay = {
  date: string;
  dayKey: string;
  label: string;
  dayNum: number;
  tutorCount: number;
};

type Props = {
  date: string;
  today: string;
  dayKey: string;
  isToday: boolean;
  slots: SlotMap;
  week: WeekDay[];
  tutors: TutorRow[];
  initialAttendance: TutorAttendanceRow[];
  initialVisits: StudentVisitRow[];
};

const HOURS = Array.from(
  { length: (TIMELINE_END_MIN - TIMELINE_START_MIN) / 60 },
  (_, i) => TIMELINE_START_MIN / 60 + i,
);

function topForMinutes(mins: number) {
  const clamped = Math.max(
    TIMELINE_START_MIN,
    Math.min(TIMELINE_END_MIN, mins),
  );
  return (clamped - TIMELINE_START_MIN) * TIMELINE_PX_PER_MIN;
}

function heightForRange(start: number, end: number) {
  return Math.max(28, (end - start) * TIMELINE_PX_PER_MIN);
}

export function DeskClient({
  date,
  today,
  dayKey,
  isToday,
  slots,
  week,
  tutors,
  initialAttendance,
  initialVisits,
}: Props) {
  const router = useRouter();
  const [attendance, setAttendance] = useState(initialAttendance);
  const [visits, setVisits] = useState(initialVisits);
  const [nowMin, setNowMin] = useState(() => {
    const p = new Date();
    return beirutMinutes(p.toISOString());
  });
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [panel, setPanel] = useState<"none" | "student" | "tutor">("none");
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const knownIds = useRef(new Set(initialAttendance.map((a) => a.id)));

  // Student form
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [course, setCourse] = useState("");
  const [tutorId, setTutorId] = useState("");
  const [studentNotes, setStudentNotes] = useState("");

  const nameToTutor = useMemo(() => {
    const map = new Map<string, TutorRow>();
    for (const t of tutors) map.set(t.name.toLowerCase(), t);
    return map;
  }, [tutors]);

  const checkedInIds = useMemo(
    () => new Set(attendance.filter((a) => !a.time_out).map((a) => a.tutor_id)),
    [attendance],
  );

  const openTutors = attendance.filter((a) => !a.time_out);
  const sortedSlots = Object.keys(slots).sort();
  const timelineHeight =
    (TIMELINE_END_MIN - TIMELINE_START_MIN) * TIMELINE_PX_PER_MIN;

  const flash = useCallback((msg: string) => {
    setError(null);
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

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

  // Live clock + auto-scroll to now
  useEffect(() => {
    const tick = () => setNowMin(beirutMinutes(new Date().toISOString()));
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isToday || !timelineRef.current) return;
    const top = topForMinutes(nowMin) - 120;
    timelineRef.current.scrollTop = Math.max(0, top);
  }, [isToday]); // eslint-disable-line react-hooks/exhaustive-deps -- only on mount / day change

  // Soft poll so arrivals from another tab appear on the timeline
  useEffect(() => {
    if (!isToday) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/attendance/tutors?date=${date}`);
        if (!res.ok) return;
        const json = await res.json();
        const rows = (json.rows ?? []) as TutorAttendanceRow[];
        for (const row of rows) {
          if (!knownIds.current.has(row.id)) {
            knownIds.current.add(row.id);
            setHighlightId(row.id);
            flash(`${row.tutors?.name ?? "Tutor"} just arrived`);
            window.setTimeout(() => setHighlightId(null), 4000);
          }
        }
        setAttendance(rows);
        const vRes = await fetch(`/api/attendance/students?date=${date}`);
        if (vRes.ok) {
          const vJson = await vRes.json();
          setVisits(vJson.rows ?? []);
        }
      } catch {
        // ignore poll errors
      }
    };
    const id = window.setInterval(poll, 12_000);
    return () => window.clearInterval(id);
  }, [date, isToday, flash]);

  useEffect(() => {
    setAttendance(initialAttendance);
    setVisits(initialVisits);
    knownIds.current = new Set(initialAttendance.map((a) => a.id));
  }, [initialAttendance, initialVisits, date]);

  function goToDate(next: string) {
    router.push(`/desk?date=${next}`);
  }

  function checkInTutor(tutor: TutorRow, scheduledShift?: string) {
    if (!isToday) {
      setError("Switch to today to check someone in.");
      return;
    }
    startTransition(async () => {
      try {
        const { row } = await api("/api/attendance/tutors", {
          action: "check_in",
          tutorId: tutor.id,
          scheduledShift: scheduledShift ?? "",
        });
        knownIds.current.add(row.id);
        setAttendance((prev) => [...prev, row]);
        setHighlightId(row.id);
        flash(`${tutor.name} checked in — now on the timeline`);
        setPanel("none");
        window.setTimeout(() => setHighlightId(null), 4000);
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
    if (!isToday) {
      setError("Switch to today to log a student.");
      return;
    }
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
        setPanel("none");
        flash(`${row.student_name} added`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
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
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  // Scheduled ghost blocks for timeline
  const scheduledBlocks = useMemo(() => {
    const blocks: {
      key: string;
      name: string;
      courses: string[];
      start: number;
      end: number;
      tutor?: TutorRow;
    }[] = [];
    for (const slot of sortedSlots) {
      const [a, b] = slot.split("-");
      const start = clockToMinutes(a);
      const end = clockToMinutes(b);
      slots[slot].forEach((entry, i) => {
        blocks.push({
          key: `${slot}-${entry.name}-${i}`,
          name: entry.name,
          courses: entry.courses,
          start,
          end,
          tutor: nameToTutor.get(entry.name.toLowerCase()),
        });
      });
    }
    return blocks;
  }, [sortedSlots, slots, nameToTutor]);

  return (
    <div className="flex min-h-0 w-full flex-1">
      {/* Sidebar — weekly schedule */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex xl:w-80">
        <div className="border-b border-slate-100 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Schedule
          </p>
          <h2 className="mt-1 font-display text-lg font-semibold text-slate-900">
            {dayKey.charAt(0).toUpperCase() + dayKey.slice(1)}
          </h2>
          <p className="text-sm text-slate-500">{date}</p>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {sortedSlots.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500">
              No tutoring slots this day. Use Check in for walk-ins.
            </p>
          ) : (
            <div className="space-y-4">
              {sortedSlots.map((slot) => (
                <div key={slot}>
                  <p className="mb-2 px-1 text-xs font-semibold text-slate-500">
                    {slotLabel(slot)}
                  </p>
                  <ul className="space-y-1.5">
                    {slots[slot].map((entry) => {
                      const tutor = nameToTutor.get(entry.name.toLowerCase());
                      const isIn = tutor
                        ? checkedInIds.has(tutor.id)
                        : false;
                      return (
                        <li
                          key={`${slot}-${entry.name}`}
                          className="group flex items-start justify-between gap-2 rounded-xl border border-transparent px-2 py-2 hover:border-slate-100 hover:bg-slate-50"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">
                              {entry.name}
                            </p>
                            <p className="truncate text-[11px] text-slate-400">
                              {entry.courses.slice(0, 3).join(", ")}
                              {entry.courses.length > 3 ? "…" : ""}
                            </p>
                          </div>
                          {tutor && isToday ? (
                            <button
                              type="button"
                              disabled={pending || isIn}
                              onClick={() => checkInTutor(tutor, slot)}
                              className="shrink-0 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white disabled:bg-slate-200 disabled:text-slate-500"
                            >
                              {isIn ? "In" : "Check in"}
                            </button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="border-t border-slate-100 p-3 space-y-2">
          <button
            type="button"
            onClick={() => setPanel("tutor")}
            className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Check in walk-in
          </button>
          <button
            type="button"
            onClick={() => setPanel("student")}
            className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Add student
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Week strip */}
        <div className="border-b border-slate-200 bg-white px-4 py-3 lg:px-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goToDate(addDays(date, -7))}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => {
                  // Jump to the week that contains today by selecting today
                  router.push("/desk");
                }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => goToDate(addDays(date, 7))}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                ›
              </button>
              {!isToday ? (
                <Link
                  href={`/desk?date=${today}`}
                  className="ml-2 text-sm font-semibold text-emerald-700 hover:underline"
                >
                  Jump to today
                </Link>
              ) : (
                <span className="ml-2 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  Live · Beirut
                </span>
              )}
            </div>
            <div className="flex gap-2 lg:hidden">
              <button
                type="button"
                onClick={() => setPanel("tutor")}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold"
              >
                Check in
              </button>
              <button
                type="button"
                onClick={() => setPanel("student")}
                className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Student
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {week.map((d) => {
              const selected = d.date === date;
              const isTodayCell = d.date === today;
              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => goToDate(d.date)}
                  className={`rounded-2xl px-1 py-2.5 text-center transition ${
                    selected
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-200"
                      : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className="text-[10px] font-semibold uppercase opacity-80">
                    {d.label}
                  </div>
                  <div className="font-display text-lg font-semibold">
                    {d.dayNum}
                  </div>
                  <div
                    className={`mt-0.5 text-[10px] ${
                      selected ? "text-emerald-100" : "text-slate-400"
                    }`}
                  >
                    {d.tutorCount ? `${d.tutorCount} on` : "—"}
                  </div>
                  {isTodayCell && !selected ? (
                    <div className="mx-auto mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {(toast || error) && (
          <div
            className={`mx-4 mt-3 rounded-xl px-4 py-2.5 text-sm lg:mx-6 ${
              error
                ? "bg-rose-50 text-rose-700"
                : "bg-emerald-50 text-emerald-800"
            }`}
          >
            {error ?? toast}
          </div>
        )}

        {/* Timeline */}
        <div
          ref={timelineRef}
          className="relative flex-1 overflow-y-auto px-2 py-4 lg:px-6"
        >
          <div className="relative mx-auto max-w-4xl" style={{ height: timelineHeight + 40 }}>
            {/* Hour grid */}
            {HOURS.map((h) => {
              const top = topForMinutes(h * 60);
              const label =
                h === 0
                  ? "12 AM"
                  : h < 12
                    ? `${h} AM`
                    : h === 12
                      ? "12 PM"
                      : `${h - 12} PM`;
              return (
                <div key={h} className="absolute right-0 left-0" style={{ top }}>
                  <div className="flex items-start gap-3">
                    <span className="w-14 shrink-0 -translate-y-2 text-right text-xs font-medium text-slate-400">
                      {label}
                    </span>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>
                </div>
              );
            })}

            {/* Scheduled ghosts */}
            <div className="absolute top-0 bottom-0 left-16 right-0">
              {scheduledBlocks.map((b, idx) => {
                const col = idx % 3;
                const isIn = b.tutor ? checkedInIds.has(b.tutor.id) : false;
                if (isIn) return null;
                return (
                  <button
                    key={b.key}
                    type="button"
                    disabled={!b.tutor || !isToday || pending}
                    onClick={() => b.tutor && checkInTutor(b.tutor, `${String(Math.floor(b.start / 60)).padStart(2,"0")}:${String(b.start % 60).padStart(2,"0")}-${String(Math.floor(b.end / 60)).padStart(2,"0")}:${String(b.end % 60).padStart(2,"0")}`)}
                    className="absolute overflow-hidden rounded-lg border border-dashed border-slate-300 bg-white/80 px-2 py-1.5 text-left transition hover:border-emerald-400 hover:bg-emerald-50/80 disabled:cursor-default"
                    style={{
                      top: topForMinutes(b.start),
                      height: heightForRange(b.start, b.end),
                      left: `calc(${col * 33}% + 4px)`,
                      width: "calc(33% - 8px)",
                    }}
                    title={isToday ? "Click to check in" : b.name}
                  >
                    <p className="truncate text-xs font-semibold text-slate-600">
                      {b.name}
                    </p>
                    <p className="truncate text-[10px] text-slate-400">
                      scheduled
                    </p>
                  </button>
                );
              })}

              {/* Live attendance blocks */}
              {attendance.map((row, idx) => {
                const start = beirutMinutes(row.time_in);
                const end = row.time_out
                  ? beirutMinutes(row.time_out)
                  : Math.max(start + 30, nowMin);
                const col = idx % 3;
                const hot = highlightId === row.id;
                return (
                  <div
                    key={row.id}
                    className={`absolute overflow-hidden rounded-xl px-2.5 py-2 shadow-sm transition ${
                      hot
                        ? "z-20 animate-pulse bg-emerald-500 text-white ring-4 ring-emerald-200"
                        : row.time_out
                          ? "bg-slate-700 text-white"
                          : "bg-emerald-600 text-white"
                    }`}
                    style={{
                      top: topForMinutes(start),
                      height: heightForRange(start, Math.min(end, TIMELINE_END_MIN)),
                      left: `calc(${col * 33}% + 4px)`,
                      width: "calc(33% - 8px)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {row.tutors?.name ?? "Tutor"}
                        </p>
                        <p className="text-[11px] opacity-90">
                          {formatClock(row.time_in)}
                          {row.time_out
                            ? ` – ${formatClock(row.time_out)}`
                            : " · here now"}
                        </p>
                      </div>
                      {!row.time_out && isToday ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => checkOutTutor(row.id)}
                          className="shrink-0 rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-bold hover:bg-white/30"
                        >
                          Out
                        </button>
                      ) : null}
                    </div>
                    {/* Students under this tutor */}
                    <ul className="mt-1 space-y-0.5">
                      {visits
                        .filter((v) => v.tutor_id === row.tutor_id)
                        .map((v) => (
                          <li
                            key={v.id}
                            className="truncate rounded bg-black/15 px-1.5 py-0.5 text-[10px]"
                          >
                            {v.student_name}
                            {v.course ? ` · ${v.course}` : ""}
                          </li>
                        ))}
                    </ul>
                  </div>
                );
              })}

              {/* Now line */}
              {isToday &&
              nowMin >= TIMELINE_START_MIN &&
              nowMin <= TIMELINE_END_MIN ? (
                <div
                  className="pointer-events-none absolute right-0 left-0 z-30 flex items-center"
                  style={{ top: topForMinutes(nowMin) }}
                >
                  <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    NOW
                  </span>
                  <div className="h-0.5 flex-1 bg-rose-500" />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Bottom activity strip */}
        <div className="border-t border-slate-200 bg-white px-4 py-3 lg:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-700">
              In now: {openTutors.length} tutor
              {openTutors.length === 1 ? "" : "s"} · {visits.filter((v) => !v.time_out).length}{" "}
              student{visits.filter((v) => !v.time_out).length === 1 ? "" : "s"}
            </p>
            <Link
              href="/desk/export"
              className="text-sm font-semibold text-emerald-700 hover:underline"
            >
              Export Excel →
            </Link>
          </div>
          {visits.length > 0 ? (
            <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {visits.map((v) => (
                <li
                  key={v.id}
                  className="flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs"
                >
                  <span className="font-medium text-slate-800">
                    {v.student_name}
                  </span>
                  <span className="text-slate-400">
                    {formatClock(v.time_in)}
                    {v.time_out
                      ? `–${formatClock(v.time_out)} (${formatDurationMinutes(v.duration_minutes)})`
                      : ""}
                  </span>
                  {!v.time_out && isToday ? (
                    <button
                      type="button"
                      onClick={() => checkOutStudent(v.id)}
                      className="font-semibold text-emerald-700"
                    >
                      Out
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </main>

      {/* Slide-over panels */}
      {panel !== "none" ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <button
            type="button"
            className="flex-1"
            aria-label="Close"
            onClick={() => setPanel("none")}
          />
          <div className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="font-display text-xl font-semibold text-slate-900">
                {panel === "student" ? "Add student" : "Check in walk-in"}
              </h3>
              <button
                type="button"
                onClick={() => setPanel("none")}
                className="rounded-full px-3 py-1 text-sm text-slate-500 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            {panel === "tutor" ? (
              <div className="space-y-2">
                <p className="mb-4 text-sm text-slate-500">
                  Tutors not already checked in today.
                </p>
                {tutors
                  .filter((t) => !checkedInIds.has(t.id))
                  .map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      disabled={pending || !isToday}
                      onClick={() => checkInTutor(t)}
                      className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-emerald-400 hover:bg-emerald-50"
                    >
                      <span className="font-medium text-slate-800">{t.name}</span>
                      <span className="text-xs font-semibold text-emerald-700">
                        Check in
                      </span>
                    </button>
                  ))}
              </div>
            ) : (
              <form onSubmit={addStudent} className="space-y-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Name</span>
                  <input
                    required
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Email</span>
                  <input
                    type="email"
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">
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
                        {a.tutors?.name} (in)
                      </option>
                    ))}
                    {tutors
                      .filter(
                        (t) => !openTutors.some((a) => a.tutor_id === t.id),
                      )
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Course</span>
                  <input
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    list="courses"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <datalist id="courses">
                    {Array.from(new Set(tutors.flatMap((t) => t.courses))).map(
                      (c) => (
                        <option key={c} value={c} />
                      ),
                    )}
                  </datalist>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Notes</span>
                  <input
                    value={studentNotes}
                    onChange={(e) => setStudentNotes(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </label>
                <button
                  type="submit"
                  disabled={pending}
                  className="w-full rounded-full bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Log visit
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
