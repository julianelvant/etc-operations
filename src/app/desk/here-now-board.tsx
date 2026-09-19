"use client";

import type { StudentVisitRow, TutorAttendanceRow } from "@/lib/attendance";
import { formatClock, slotLabel } from "@/lib/schedule";

type Props = {
  openTutors: TutorAttendanceRow[];
  visitsByTutorId: Map<string, StudentVisitRow[]>;
  highlightId: string | null;
  isToday: boolean;
  isPending: (key: string) => boolean;
  onCheckOut: (id: string) => void;
  onAddStudent: (tutorId: string) => void;
  onCheckOutStudent: (id: string) => void;
};

export function HereNowBoard({
  openTutors,
  visitsByTutorId,
  highlightId,
  isToday,
  isPending,
  onCheckOut,
  onAddStudent,
  onCheckOutStudent,
}: Props) {
  return (
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
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {openTutors.map((row) => {
            const students = visitsByTutorId.get(row.tutor_id) ?? [];
            const openStudents = students.filter((v) => !v.time_out);
            const hot = highlightId === row.id;
            const outPending = isPending(`out:${row.id}`);
            const shiftDisplay = row.scheduled_shift
              ? slotLabel(row.scheduled_shift.split(",")[0].trim())
              : null;
            return (
              <li
                key={row.id}
                className={`flex flex-col rounded-2xl bg-emerald-700 p-4 text-white shadow-sm transition ${
                  hot ? "ring-2 ring-emerald-300 ring-offset-2" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-semibold">
                      {row.tutors?.name ?? "Tutor"}
                    </p>
                    <p className="text-sm text-emerald-100">
                      In since {formatClock(row.time_in)}
                      {shiftDisplay ? ` · ${shiftDisplay}` : ""}
                    </p>
                  </div>
                  {isToday ? (
                    <button
                      type="button"
                      disabled={outPending}
                      onClick={() => onCheckOut(row.id)}
                      className="inline-flex min-h-11 shrink-0 items-center rounded-lg bg-white/15 px-3 text-sm font-bold hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60"
                    >
                      Check out
                    </button>
                  ) : null}
                </div>

                <div className="mt-3 flex-1">
                  {openStudents.length === 0 ? (
                    <p className="text-xs text-emerald-100/80">No students yet</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {openStudents.map((v) => (
                        <li
                          key={v.id}
                          className="flex items-center justify-between gap-2 rounded-lg bg-black/15 px-2.5 py-2 text-xs"
                        >
                          <span className="min-w-0 truncate">
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

                {isToday ? (
                  <button
                    type="button"
                    onClick={() => onAddStudent(row.tutor_id)}
                    className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-white/25 text-sm font-semibold text-emerald-50 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    + Add student
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
