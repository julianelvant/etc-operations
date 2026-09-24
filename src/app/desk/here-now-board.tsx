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
        <div>
          <h2
            id="here-now-heading"
            className="font-display text-xl font-semibold text-ink"
          >
            Here now
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            {openTutors.length} tutor{openTutors.length === 1 ? "" : "s"} checked
            in
          </p>
        </div>

        {openTutors.length === 0 ? (
          <div className="surface-panel border-dashed px-5 py-8 text-center">
            <p className="text-base font-semibold text-ink">
              No one checked in yet
            </p>
            <p className="mt-1 text-sm text-muted">
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
      className={`relative overflow-hidden rounded-xl border border-[var(--status-here-border)] bg-surface text-ink transition ${
        hot ? "ring-2 ring-brand ring-offset-2" : ""
      }`}
      onContextMenu={(e) => {
        if (!onEditTimes) return;
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <div className="absolute inset-y-0 left-0 w-1 bg-brand" aria-hidden />
      <div className="flex items-stretch gap-1 p-2 pl-3 sm:p-2.5 sm:pl-3.5">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-brand-soft focus-ring"
        >
          <span
            className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand-ink transition ${
              open ? "rotate-90" : ""
            }`}
            aria-hidden
          >
            ▸
          </span>
          <span className="min-w-0 flex-1">
            <span className="block break-words text-base font-semibold leading-snug sm:text-lg">
              {row.tutors?.name ?? "Tutor"}
            </span>
            <span className="mt-0.5 block text-sm tabular-nums text-muted">
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
            className="btn-primary m-1 min-h-11 shrink-0 self-center px-3"
          >
            Check out
          </button>
        ) : null}
      </div>

      {open ? (
        <div
          id={panelId}
          className="space-y-4 border-t border-border px-4 pb-4 pt-3"
        >
          {isToday ? (
            <TutorMetaEditor
              row={row}
              autoFocusComment={autoFocusComment}
              disabled={isPending(`meta:${row.id}`)}
              onSave={onUpdateTutorMeta}
            />
          ) : row.notes || row.role ? (
            <p className="text-xs text-muted">
              {row.role ? `${row.role}` : ""}
              {row.role && row.notes ? " · " : ""}
              {row.notes}
            </p>
          ) : null}

          <div>
            {openStudents.length === 0 ? (
              <p className="text-xs text-muted">No students yet</p>
            ) : (
              <ul className="space-y-2">
                {openStudents.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-start justify-between gap-3 rounded-lg bg-bg px-3 py-2 text-xs"
                  >
                    <span className="min-w-0 leading-snug break-words text-ink">
                      {v.student_name}
                      {v.course ? ` · ${v.course}` : ""}
                    </span>
                    {isToday ? (
                      <button
                        type="button"
                        disabled={isPending(`sout:${v.id}`)}
                        onClick={() => onCheckOutStudent(v.id)}
                        className="min-h-8 shrink-0 px-1 font-semibold text-brand-ink hover:underline focus-ring disabled:opacity-60"
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
                className="btn-secondary flex-1"
              >
                Edit times
              </button>
            ) : null}
            {isToday ? (
              <button
                type="button"
                onClick={() => onAddStudent(row.tutor_id)}
                className="btn-secondary flex-1"
              >
                + Add student
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {menu && onEditTimes ? (
        <div
          className="fixed z-50 min-w-[10rem] overflow-hidden rounded-lg border border-border bg-surface py-1 text-ink shadow-lg"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
        >
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm font-medium hover:bg-brand-soft"
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
      <h2
        id="offered-courses-heading"
        className="text-sm font-semibold text-ink"
      >
        Offered courses
        <span className="ml-2 font-normal tabular-nums text-muted">
          {byCourse.length}
        </span>
      </h2>

      {byCourse.length === 0 ? (
        <p className="text-xs text-muted">No courses yet.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {byCourse.map(({ course, hereCount }) => {
            const selected = openCourse === course;
            return (
              <button
                key={course}
                type="button"
                aria-expanded={selected}
                aria-label={
                  hereCount > 0
                    ? `${hereCount} tutor${hereCount === 1 ? "" : "s"} here for ${course}`
                    : course
                }
                onClick={() =>
                  setOpenCourse((c) => (c === course ? null : course))
                }
                className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition focus-ring ${
                  selected
                    ? "border-brand bg-brand text-white"
                    : hereCount > 0
                      ? "border-[var(--status-here-border)] bg-[var(--status-here-bg)] text-[var(--status-here-ink)]"
                      : "border-border bg-surface text-ink hover:border-slate-300"
                }`}
              >
                <span className="break-words text-left">{course}</span>
                {hereCount > 0 ? (
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                      selected
                        ? "bg-white/20 text-white"
                        : "bg-brand text-white"
                    }`}
                  >
                    {hereCount} here
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      {active ? (
        <ul className="flex flex-wrap gap-1.5 rounded-lg border border-border bg-surface p-2">
          {active.tutors.map((t) => {
            const here = hereIds.has(t.id);
            return (
              <li
                key={t.id}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${
                  here
                    ? "bg-[var(--status-here-bg)] text-[var(--status-here-ink)]"
                    : "bg-bg text-muted"
                }`}
              >
                <span className="break-words">{t.name}</span>
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
    <div className="space-y-3 rounded-lg bg-bg p-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Role</span>
        <select
          value={
            ROLE_OPTIONS.includes(role as (typeof ROLE_OPTIONS)[number])
              ? role
              : "Other"
          }
          onChange={(e) => setRole(e.target.value)}
          disabled={disabled}
          className="input-field"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">
          Comment
        </span>
        <textarea
          ref={commentRef}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={disabled}
          rows={2}
          className="input-field min-h-[4rem] resize-y"
          placeholder="Optional note — exports to Excel Notes"
        />
      </label>
      {dirty || autoFocusComment ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSave(row.id, { role, notes })}
          className="btn-primary w-full min-h-10"
        >
          Save comment
        </button>
      ) : null}
    </div>
  );
}
