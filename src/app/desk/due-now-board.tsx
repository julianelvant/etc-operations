"use client";

import type { TutorRow } from "@/lib/attendance";
import { slotLabel, type MergedShift, type ShiftStatus } from "@/lib/schedule";

type Row = MergedShift & { status: ShiftStatus };

type Props = {
  rows: Row[];
  nameToTutor: Map<string, TutorRow>;
  isToday: boolean;
  isPending: (key: string) => boolean;
  onCheckIn: (
    tutor: TutorRow,
    scheduledShift: string,
    opts?: { notes?: string; role?: string },
  ) => void;
};

export function DueNowBoard({
  rows,
  nameToTutor,
  isToday,
  isPending,
  onCheckIn,
}: Props) {
  return (
    <section className="space-y-3" aria-labelledby="due-now-heading">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">
            Next up
          </p>
          <h2
            id="due-now-heading"
            className="font-display text-2xl font-semibold text-slate-900"
          >
            Due now
          </h2>
        </div>
        <p className="text-sm tabular-nums text-slate-500">
          {rows.length} tutor{rows.length === 1 ? "" : "s"}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-5 py-8 text-center">
          <p className="text-sm font-medium text-slate-700">
            Nobody due right now
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Use search or Walk-in when someone arrives early.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {rows.map((row) => {
            const tutor = nameToTutor.get(row.name.toLowerCase());
            const pending = tutor ? isPending(`in:${tutor.id}`) : false;
            return (
              <li
                key={`${row.name}-${row.shiftLabel}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-3 py-3 sm:px-4"
              >
                <div className="min-w-0">
                  <p className="text-base font-semibold leading-snug text-slate-900">
                    {row.name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {slotLabel(row.shiftLabel)}
                  </p>
                  {row.courses.length > 0 ? (
                    <p
                      className="mt-0.5 text-xs leading-snug text-slate-400 break-words"
                      title={row.courses.join(", ")}
                    >
                      {row.courses.join(", ")}
                    </p>
                  ) : null}
                </div>
                <div className="flex w-[9.5rem] shrink-0 flex-col items-end gap-2 sm:w-[10.5rem] sm:flex-row sm:items-center sm:justify-end">
                  <StatusPill status={row.status} />
                  {tutor && isToday ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onCheckIn(tutor, row.shiftLabel)}
                      className="inline-flex min-h-11 w-full min-w-[5.5rem] items-center justify-center rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-60 sm:w-auto"
                    >
                      Check in
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function LaterToday({
  rows,
  nameToTutor,
  isToday,
  isPending,
  onCheckIn,
}: Props) {
  if (rows.length === 0) return null;

  return (
    <details className="group rounded-2xl border border-slate-200 bg-white open:shadow-sm">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Schedule
          </span>
          <span className="font-display text-lg font-semibold text-slate-900">
            Later today
          </span>
        </span>
        <span className="text-sm tabular-nums text-slate-500">
          {rows.length} · expand
        </span>
      </summary>
      <ul className="divide-y divide-slate-100 border-t border-slate-100">
        {rows.map((row) => {
          const tutor = nameToTutor.get(row.name.toLowerCase());
          const pending = tutor ? isPending(`in:${tutor.id}`) : false;
          return (
            <li
              key={`${row.name}-${row.shiftLabel}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium leading-snug text-slate-900">
                  {row.name}
                </p>
                <p className="text-xs text-slate-500">
                  {slotLabel(row.shiftLabel)}
                </p>
                {row.courses.length > 0 ? (
                  <p className="mt-0.5 text-xs leading-snug text-slate-400 break-words">
                    {row.courses.join(", ")}
                  </p>
                ) : null}
              </div>
              <div className="flex w-[9.5rem] shrink-0 flex-col items-end gap-2 sm:w-[10.5rem] sm:flex-row sm:items-center sm:justify-end">
                <StatusPill status={row.status} />
                {tutor && isToday ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onCheckIn(tutor, row.shiftLabel)}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-60 sm:w-auto"
                  >
                    Check in
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

/** Always-visible full day roster (merged shifts + timings). */
export function DayScheduleList({
  shifts,
  nameToTutor,
  checkedInIds,
  closedTutorIds,
  isToday,
  isPending,
  onCheckIn,
}: {
  shifts: MergedShift[];
  nameToTutor: Map<string, TutorRow>;
  checkedInIds: Set<string>;
  closedTutorIds: Set<string>;
  isToday: boolean;
  isPending: (key: string) => boolean;
  onCheckIn: (tutor: TutorRow, scheduledShift: string) => void;
}) {
  if (shifts.length === 0) {
    return (
      <section className="space-y-3" aria-labelledby="day-schedule-heading">
        <h2
          id="day-schedule-heading"
          className="font-display text-xl font-semibold text-slate-900"
        >
          Today&apos;s schedule
        </h2>
        <p className="text-sm text-slate-500">No tutoring shifts this day.</p>
      </section>
    );
  }

  return (
    <section className="space-y-3" aria-labelledby="day-schedule-heading">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Full day
          </p>
          <h2
            id="day-schedule-heading"
            className="font-display text-xl font-semibold text-slate-900"
          >
            Today&apos;s schedule
          </h2>
        </div>
        <p className="text-sm tabular-nums text-slate-500">
          {shifts.length} shift{shifts.length === 1 ? "" : "s"}
        </p>
      </div>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {shifts.map((row) => {
          const tutor = nameToTutor.get(row.name.toLowerCase());
          const here = tutor ? checkedInIds.has(tutor.id) : false;
          const done = tutor ? closedTutorIds.has(tutor.id) && !here : false;
          const pending = tutor ? isPending(`in:${tutor.id}`) : false;
          return (
            <li
              key={`sched-${row.name}-${row.shiftLabel}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-3 py-3 sm:px-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-snug text-slate-900">
                  {row.name}
                </p>
                <p className="text-xs text-slate-500">
                  {slotLabel(row.shiftLabel)}
                </p>
                {row.courses.length > 0 ? (
                  <p className="mt-0.5 text-xs leading-snug text-slate-400 break-words">
                    {row.courses.join(", ")}
                  </p>
                ) : null}
              </div>
              <div className="flex w-[9.5rem] shrink-0 flex-col items-end gap-2 sm:w-[10.5rem] sm:flex-row sm:items-center sm:justify-end">
                {here ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                    Here
                  </span>
                ) : done ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                    Done
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    Scheduled
                  </span>
                )}
                {tutor && isToday && !here ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onCheckIn(tutor, row.shiftLabel)}
                    className="inline-flex min-h-11 w-full min-w-[5.5rem] items-center justify-center rounded-full border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-60 sm:w-auto"
                  >
                    Check in
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function StatusPill({ status }: { status: ShiftStatus }) {
  if (status === "late") {
    return (
      <span
        className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800"
        aria-label="Status: late"
      >
        Late
      </span>
    );
  }
  if (status === "due") {
    return (
      <span
        className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900"
        aria-label="Status: due"
      >
        Due
      </span>
    );
  }
  if (status === "upcoming") {
    return (
      <span
        className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
        aria-label="Status: upcoming"
      >
        Upcoming
      </span>
    );
  }
  if (status === "done") {
    return (
      <span
        className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500"
        aria-label="Status: done"
      >
        Done
      </span>
    );
  }
  return (
    <span
      className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800"
      aria-label="Status: here"
    >
      Here
    </span>
  );
}
