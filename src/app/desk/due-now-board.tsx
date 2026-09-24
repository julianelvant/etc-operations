"use client";

import type { TutorRow } from "@/lib/attendance";
import { slotLabel, type MergedShift, type ShiftStatus } from "@/lib/schedule";
import { StatusPill } from "./status-pill";

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
      <div>
        <h2
          id="due-now-heading"
          className="font-display text-xl font-semibold text-ink"
        >
          Due now
        </h2>
        <p className="mt-0.5 text-sm text-muted">
          {rows.length} tutor{rows.length === 1 ? "" : "s"} in the next window
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="surface-panel border-dashed px-5 py-8 text-center">
          <p className="text-sm font-medium text-ink">Nobody due right now</p>
          <p className="mt-1 text-sm text-muted">
            Use search or Walk-in when someone arrives early.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden surface-panel">
          {rows.map((row) => {
            const tutor = nameToTutor.get(row.name.toLowerCase());
            const pending = tutor ? isPending(`in:${tutor.id}`) : false;
            return (
              <li
                key={`${row.name}-${row.shiftLabel}`}
                className="flex items-center justify-between gap-4 px-5 py-3.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="break-words text-base font-semibold text-ink">
                    {row.name}
                  </p>
                  <p className="mt-0.5 whitespace-nowrap text-sm tabular-nums text-muted">
                    {slotLabel(row.shiftLabel)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusPill status={row.status} />
                  {tutor && isToday ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onCheckIn(tutor, row.shiftLabel)}
                      className="btn-primary min-w-[5.5rem] px-4"
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
