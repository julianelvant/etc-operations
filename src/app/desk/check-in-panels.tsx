"use client";

import { useEffect, useMemo, useState } from "react";
import type { TutorAttendanceRow, TutorRow } from "@/lib/attendance";
import type { DeskPanel } from "./desk-types";

type Props = {
  panel: DeskPanel;
  onClose: () => void;
  tutors: TutorRow[];
  openTutors: TutorAttendanceRow[];
  checkedInIds: Set<string>;
  isToday: boolean;
  pending: boolean;
  defaultTutorId: string;
  onCheckIn: (tutor: TutorRow) => void;
  onAddStudent: (payload: {
    studentName: string;
    studentEmail: string;
    course: string;
    tutorId: string;
    studentNotes: string;
  }) => void;
};

export function CheckInPanels({
  panel,
  onClose,
  tutors,
  openTutors,
  checkedInIds,
  isToday,
  pending,
  defaultTutorId,
  onCheckIn,
  onAddStudent,
}: Props) {
  const [query, setQuery] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [course, setCourse] = useState("");
  const [tutorId, setTutorId] = useState(defaultTutorId);
  const [studentNotes, setStudentNotes] = useState("");

  useEffect(() => {
    if (panel === "student") setTutorId(defaultTutorId);
    if (panel === "tutor") setQuery("");
    if (panel === "none") {
      setStudentName("");
      setStudentEmail("");
      setCourse("");
      setStudentNotes("");
      setQuery("");
    }
  }, [panel, defaultTutorId]);

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tutors
      .filter((t) => !checkedInIds.has(t.id))
      .filter((t) => {
        if (!q) return true;
        if (t.name.toLowerCase().includes(q)) return true;
        return t.courses.some((c) => c.toLowerCase().includes(q));
      });
  }, [tutors, checkedInIds, query]);

  if (panel === "none") return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <button
        type="button"
        className="flex-1"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold text-slate-900">
            {panel === "student" ? "Add student" : "Check in walk-in"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        {panel === "tutor" ? (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Search name or course
              </span>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Amir or EECE 210"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>
            <p className="text-sm text-slate-500">
              Tutors not already checked in today.
            </p>
            <div className="space-y-2">
              {available.length === 0 ? (
                <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500">
                  No matches.
                </p>
              ) : (
                available.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={pending || !isToday}
                    onClick={() => onCheckIn(t)}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-emerald-400 hover:bg-emerald-50 disabled:opacity-60"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium text-slate-800">
                        {t.name}
                      </span>
                      {t.courses.length > 0 ? (
                        <span className="block truncate text-[11px] text-slate-400">
                          {t.courses.slice(0, 4).join(", ")}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-emerald-700">
                      Check in
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onAddStudent({
                studentName,
                studentEmail,
                course,
                tutorId,
                studentNotes,
              });
              setStudentName("");
              setStudentEmail("");
              setCourse("");
              setStudentNotes("");
            }}
            className="space-y-4"
          >
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Name</span>
              <input
                required
                autoFocus
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
                  .filter((t) => !openTutors.some((a) => a.tutor_id === t.id))
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
  );
}
