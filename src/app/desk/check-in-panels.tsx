"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TutorAttendanceRow, TutorRow } from "@/lib/attendance";
import type { DeskPanel } from "./desk-types";
import { CourseList } from "./course-list";

const ROLE_OPTIONS = ["Tutor", "TA", "Coordinator", "Other"] as const;

type Props = {
  panel: DeskPanel;
  onClose: () => void;
  tutors: TutorRow[];
  openTutors: TutorAttendanceRow[];
  checkedInIds: Set<string>;
  isToday: boolean;
  isPending: (key: string) => boolean;
  defaultTutorId: string;
  initialQuery?: string;
  onCheckIn: (
    tutor: TutorRow,
    opts?: { notes?: string; role?: string; scheduledShift?: string },
  ) => void;
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
  isPending,
  defaultTutorId,
  initialQuery = "",
  onCheckIn,
  onAddStudent,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState("");
  const [tutorNotes, setTutorNotes] = useState("");
  const [tutorRole, setTutorRole] = useState<string>("Tutor");
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [course, setCourse] = useState("");
  const [tutorId, setTutorId] = useState(defaultTutorId);
  const [studentNotes, setStudentNotes] = useState("");

  useEffect(() => {
    if (panel === "none") return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const root = panelRef.current;
    if (!root) return;

    const focusables = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));

    const first = focusables()[0];
    first?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key !== "Tab" || !root) return;
      const list = focusables();
      if (list.length === 0) return;
      const firstEl = list[0];
      const lastEl = list[list.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }

    root.addEventListener("keydown", onKey);
    return () => {
      root.removeEventListener("keydown", onKey);
      previouslyFocused.current?.focus?.();
    };
  }, [panel]);

  useEffect(() => {
    if (panel === "student") setTutorId(defaultTutorId);
    if (panel === "tutor") setQuery(initialQuery);
    if (panel === "none") {
      setStudentName("");
      setStudentEmail("");
      setCourse("");
      setStudentNotes("");
      setQuery("");
      setTutorNotes("");
      setTutorRole("Tutor");
    }
  }, [panel, defaultTutorId, initialQuery]);

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

  const tutorNotHere =
    tutorId && !openTutors.some((a) => a.tutor_id === tutorId);

  if (panel === "none") return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/30"
      role="dialog"
      aria-modal="true"
      aria-labelledby="desk-panel-title"
    >
      <button
        type="button"
        className="flex-1"
        aria-label="Close panel"
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-white p-6 shadow-2xl"
      >
        <div className="mb-6 flex items-center justify-between gap-3">
          <h3
            id="desk-panel-title"
            className="font-display text-xl font-semibold text-slate-900"
          >
            {panel === "student" ? "Add student" : "Check in walk-in"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
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
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Amir or EECE 210"
                className="w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Role
              </span>
              <select
                value={tutorRole}
                onChange={(e) => setTutorRole(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Comment
              </span>
              <textarea
                value={tutorNotes}
                onChange={(e) => setTutorNotes(e.target.value)}
                rows={2}
                placeholder="Optional — exports to Tutors Notes"
                className="w-full resize-y rounded-xl border border-slate-300 px-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </label>
            <p className="text-sm text-slate-500">
              Tutors not already checked in today.
            </p>
            <ul className="space-y-2">
              {available.length === 0 ? (
                <li className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500">
                  No matches.
                </li>
              ) : (
                available.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      disabled={isPending(`in:${t.id}`) || !isToday}
                      onClick={() =>
                        onCheckIn(t, {
                          notes: tutorNotes,
                          role: tutorRole,
                        })
                      }
                      className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-emerald-400 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-60"
                    >
                      <span className="min-w-0">
                        <span className="block break-words font-medium text-ink">
                          {t.name}
                        </span>
                        <CourseList courses={t.courses} className="mt-1.5" />
                      </span>
                      <span className="w-20 shrink-0 text-right text-sm font-semibold text-brand-ink">
                        Check in
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
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
              <span className="mb-1 block text-sm font-medium">std name</span>
              <input
                required
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">std email</span>
              <input
                type="email"
                value={studentEmail}
                onChange={(e) => setStudentEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">
                tutor who helped
              </span>
              <select
                value={tutorId}
                onChange={(e) => {
                  setTutorId(e.target.value);
                  const t = tutors.find((x) => x.id === e.target.value);
                  if (t?.courses?.[0] && !course) setCourse(t.courses[0]);
                }}
                className="w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <option value="">— Select —</option>
                {openTutors.map((a) => (
                  <option key={a.id} value={a.tutor_id}>
                    {a.tutors?.name} (here)
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
            {tutorNotHere ? (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                That tutor is not checked in. Prefer someone under Here now when
                possible.
              </p>
            ) : null}
            <label className="block">
              <span className="mb-1 block text-sm font-medium">course</span>
              <input
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                list="courses"
                className="w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
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
              <span className="mb-1 block text-sm font-medium">notes</span>
              <textarea
                value={studentNotes}
                onChange={(e) => setStudentNotes(e.target.value)}
                rows={3}
                className="w-full resize-y rounded-xl border border-slate-300 px-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </label>
            <button
              type="submit"
              disabled={isPending("student:add")}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-60"
            >
              Log visit
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
