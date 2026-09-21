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
    <section className="space-y-4" aria-labelledby="due-now-heading">
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
                className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold leading-snug text-slate-900">
                    {row.name}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {slotLabel(row.shiftLabel)}
                  </p>
                  {row.courses.length > 0 ? (
                    <p
                      className="mt-1 text-xs leading-snug text-slate-400 break-words"
                      title={row.courses.join(", ")}
                    >
                      {row.courses.join(", ")}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <StatusPill status={row.status} />
                  {tutor && isToday ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onCheckIn(tutor, row.shiftLabel)}
                      className="inline-flex min-h-11 min-w-[5.5rem] items-center justify-center rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-60"
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
