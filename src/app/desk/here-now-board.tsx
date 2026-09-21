"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  StudentVisitRow,
  TutorAttendanceRow,
  TutorRow,
} from "@/lib/attendance";
import { formatClock, slotLabel } from "@/lib/schedule";

const ROLE_OPTIONS = ["Tutor", "TA", "Coordinator", "Other"] as const;

type Props = {
  openTutors: TutorAttendanceRow[];
  tutors: TutorRow[];
  visitsByTutorId: Map<string, StudentVisitRow[]>;
  highlightId: string | null;
  commentFocusId: string | null;
  isToday: boolean;
  isPending: (key: string) => boolean;
  onCheckOut: (id: string) => void;
  onAddStudent: (tutorId: string) => void;
  onCheckOutStudent: (id: string) => void;
  onUpdateTutorMeta: (
    id: string,
    patch: { notes?: string; role?: string },
  ) => void;
  onEditTimes?: (row: TutorAttendanceRow) => void;
};

export function HereNowBoard({
  openTutors,
  tutors,
  visitsByTutorId,
  highlightId,
  commentFocusId,
  isToday,
  isPending,
  onCheckOut,
  onAddStudent,
  onCheckOutStudent,
  onUpdateTutorMeta,
  onEditTimes,
}: Props) {
  const hereIds = useMemo(
    () => new Set(openTutors.map((r) => r.tutor_id)),
    [openTutors],
  );

  return (
    <div className="space-y-4">
      <section className="space-y-3" aria-labelledby="here-now-heading">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Live
            </p>
            <h2
              id="here-now-heading"
              className="font-display text-2xl font-semibold text-slate-900"
            >
              Here now
            </h2>
          </div>
          <p className="text-sm tabular-nums text-slate-500">
            {openTutors.length} tutor{openTutors.length === 1 ? "" : "s"}
          </p>
        </div>

        {openTutors.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-5 py-8 text-center">
            <p className="font-display text-lg font-semibold text-slate-800">
              No one checked in yet
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Search a name above or check in from Due now.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 grid-cols-1 md:grid-cols-2">
            {openTutors.map((row) => (
              <HereNowCard
                key={row.id}
                row={row}
                openStudents={(visitsByTutorId.get(row.tutor_id) ?? []).filter(
                  (v) => !v.time_out,
                )}
                forceOpen={
                  highlightId === row.id || commentFocusId === row.id
                }
                hot={highlightId === row.id}
                autoFocusComment={commentFocusId === row.id}
                isToday={isToday}
                isPending={isPending}
                onCheckOut={onCheckOut}
                onAddStudent={onAddStudent}
                onCheckOutStudent={onCheckOutStudent}
                onUpdateTutorMeta={onUpdateTutorMeta}
                onEditTimes={onEditTimes}
              />
            ))}
          </ul>
        )}
      </section>

      <OfferedCourses tutors={tutors} hereIds={hereIds} />
    </div>
  );
}

function HereNowCard({
  row,
  openStudents,
  forceOpen,
  hot,
  autoFocusComment,
  isToday,
  isPending,
  onCheckOut,
  onAddStudent,
  onCheckOutStudent,
  onUpdateTutorMeta,
  onEditTimes,
}: {
  row: TutorAttendanceRow;
  openStudents: StudentVisitRow[];
  forceOpen: boolean;
  hot: boolean;
  autoFocusComment: boolean;
  isToday: boolean;
  isPending: (key: string) => boolean;
  onCheckOut: (id: string) => void;
  onAddStudent: (tutorId: string) => void;
  onCheckOutStudent: (id: string) => void;
  onUpdateTutorMeta: (
    id: string,
    patch: { notes?: string; role?: string },
  ) => void;
  onEditTimes?: (row: TutorAttendanceRow) => void;
}) {
  const [open, setOpen] = useState(forceOpen);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const outPending = isPending(`out:${row.id}`);
  const shiftDisplay = row.scheduled_shift
    ? slotLabel(row.scheduled_shift.split(",")[0].trim())
    : null;
  const meta = [`In since ${formatClock(row.time_in)}`, shiftDisplay]
    .filter(Boolean)
    .join(" · ");

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  const panelId = `here-panel-${row.id}`;

  return (
    <li
      className={`relative rounded-2xl bg-emerald-700 text-white shadow-sm transition ${
        hot ? "ring-2 ring-emerald-300 ring-offset-2" : ""
      }`}
      onContextMenu={(e) => {
        if (!onEditTimes) return;
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <div className="flex items-stretch gap-1 p-2 sm:p-2.5">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <span
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-emerald-50 transition ${
              open ? "rotate-90" : ""
            }`}
            aria-hidden
          >
            ▸
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-base font-semibold leading-snug sm:text-lg">
              {row.tutors?.name ?? "Tutor"}
            </span>
            <span className="mt-0.5 block truncate text-sm tabular-nums text-emerald-100">
              {meta}
              {openStudents.length > 0
                ? ` · ${openStudents.length} student${
                    openStudents.length === 1 ? "" : "s"
                  }`
                : ""}
            </span>
          </span>
        </button>
        {isToday ? (
          <button
            type="button"
            disabled={outPending}
            onClick={() => onCheckOut(row.id)}
            className="m-1 inline-flex min-h-11 shrink-0 items-center justify-center self-center rounded-lg bg-white/15 px-3 text-sm font-bold hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60"
          >
            Check out
          </button>
        ) : null}
      </div>

      {open ? (
        <div
          id={panelId}
          className="space-y-4 border-t border-white/15 px-4 pb-4 pt-3"
        >
          {isToday ? (
            <TutorMetaEditor
              row={row}
              autoFocusComment={autoFocusComment}
              disabled={isPending(`meta:${row.id}`)}
              onSave={onUpdateTutorMeta}
            />
          ) : row.notes || row.role ? (
            <p className="text-xs text-emerald-100/90">
              {row.role ? `${row.role}` : ""}
              {row.role && row.notes ? " · " : ""}
              {row.notes}
            </p>
          ) : null}

          <div>
            {openStudents.length === 0 ? (
              <p className="text-xs text-emerald-100/80">No students yet</p>
            ) : (
              <ul className="space-y-2">
                {openStudents.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-start justify-between gap-3 rounded-lg bg-black/15 px-3 py-2 text-xs"
                  >
                    <span className="min-w-0 leading-snug break-words">
                      {v.student_name}
                      {v.course ? ` · ${v.course}` : ""}
                    </span>
                    {isToday ? (
                      <button
                        type="button"
                        disabled={isPending(`sout:${v.id}`)}
                        onClick={() => onCheckOutStudent(v.id)}
                        className="min-h-8 shrink-0 px-1 font-semibold text-emerald-100 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60"
                      >
                        Out
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {onEditTimes ? (
              <button
                type="button"
                onClick={() => onEditTimes(row)}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-white/25 text-sm font-semibold text-emerald-50 hover:bg-white/10"
              >
                Edit times
              </button>
            ) : null}
            {isToday ? (
              <button
                type="button"
                onClick={() => onAddStudent(row.tutor_id)}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-white/25 text-sm font-semibold text-emerald-50 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                + Add student
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {menu && onEditTimes ? (
        <div
          className="fixed z-50 min-w-[10rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-slate-900 shadow-lg"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
        >
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm font-medium hover:bg-emerald-50"
            onClick={() => {
              setMenu(null);
              onEditTimes(row);
            }}
          >
            Edit times…
          </button>
        </div>
      ) : null}
    </li>
  );
}

function OfferedCourses({
  tutors,
  hereIds,
}: {
  tutors: TutorRow[];
  hereIds: Set<string>;
}) {
  const [openCourse, setOpenCourse] = useState<string | null>(null);

  const byCourse = useMemo(() => {
    const map = new Map<string, TutorRow[]>();
    for (const t of tutors) {
      if (!t.active) continue;
      for (const raw of t.courses ?? []) {
        const course = String(raw).trim();
        if (!course) continue;
        const list = map.get(course) ?? [];
        list.push(t);
        map.set(course, list);
      }
    }
    return [...map.entries()]
      .map(([course, list]) => ({
        course,
        tutors: list.sort((a, b) => a.name.localeCompare(b.name)),
        hereCount: list.filter((t) => hereIds.has(t.id)).length,
      }))
      .sort((a, b) => a.course.localeCompare(b.course));
  }, [tutors, hereIds]);

  const active = byCourse.find((c) => c.course === openCourse) ?? null;

  return (
    <section className="space-y-2" aria-labelledby="offered-courses-heading">
      <div className="flex items-baseline justify-between gap-2">
        <h2
          id="offered-courses-heading"
          className="text-sm font-semibold text-slate-700"
        >
          Offered courses
          <span className="ml-2 font-normal tabular-nums text-slate-400">
            {byCourse.length}
          </span>
        </h2>
      </div>

      {byCourse.length === 0 ? (
        <p className="text-xs text-slate-500">No courses yet.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {byCourse.map(({ course, hereCount }) => {
            const selected = openCourse === course;
            return (
              <button
                key={course}
                type="button"
                aria-expanded={selected}
                onClick={() =>
                  setOpenCourse((c) => (c === course ? null : course))
                }
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  selected
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : hereCount > 0
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-400"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                <span className="max-w-[9rem] truncate">{course}</span>
                {hereCount > 0 ? (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                      selected
                        ? "bg-white/20 text-white"
                        : "bg-emerald-600 text-white"
                    }`}
                  >
                    {hereCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      {active ? (
        <ul className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-2">
          {active.tutors.map((t) => {
            const here = hereIds.has(t.id);
            return (
              <li
                key={t.id}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                  here
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                <span className="max-w-[10rem] truncate">{t.name}</span>
                {here ? (
                  <span className="text-[10px] font-bold uppercase opacity-90">
                    Here
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

function TutorMetaEditor({
  row,
  autoFocusComment,
  disabled,
  onSave,
}: {
  row: TutorAttendanceRow;
  autoFocusComment: boolean;
  disabled: boolean;
  onSave: (id: string, patch: { notes?: string; role?: string }) => void;
}) {
  const [role, setRole] = useState(row.role || "Tutor");
  const [notes, setNotes] = useState(row.notes || "");
  const commentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setRole(row.role || "Tutor");
    setNotes(row.notes || "");
  }, [row.id, row.role, row.notes]);

  useEffect(() => {
    if (!autoFocusComment) return;
    const el = commentRef.current;
    if (!el) return;
    el.focus();
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [autoFocusComment, row.id]);

  const dirty =
    role.trim() !== (row.role || "Tutor").trim() ||
    notes !== (row.notes || "");

  return (
    <div className="space-y-3 rounded-xl bg-black/10 p-3">
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-emerald-100/80">
          Role
        </span>
        <select
          value={
            ROLE_OPTIONS.includes(role as (typeof ROLE_OPTIONS)[number])
              ? role
              : "Other"
          }
          onChange={(e) => setRole(e.target.value)}
          disabled={disabled}
          className="w-full rounded-lg border-0 bg-white/15 px-2.5 py-2 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r} className="text-slate-900">
              {r}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-emerald-100/80">
          Comment
        </span>
        <textarea
          ref={commentRef}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={disabled}
          rows={2}
          className="w-full resize-y rounded-lg border-0 bg-white/15 px-2.5 py-2 text-sm text-white placeholder:text-emerald-100/50 outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          placeholder="Optional note — exports to Excel Notes"
        />
      </label>
      {dirty || autoFocusComment ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSave(row.id, { role, notes })}
          className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-white/20 text-sm font-semibold hover:bg-white/30 disabled:opacity-60"
        >
          Save comment
        </button>
      ) : null}
    </div>
  );
}
