"use client";

import { useMemo } from "react";
import type { TutorRow } from "@/lib/attendance";
import {
  getMergedShiftsForDay,
  slotLabel,
  type MergedShift,
} from "@/lib/schedule";
import type { SlotMap } from "./desk-types";

type Status = "scheduled" | "here" | "done";

type RosterRow = MergedShift & {
  key: string;
  tutor?: TutorRow;
  status: Status;
  letter: string;
};

type Props = {
  slots: SlotMap;
  nameToTutor: Map<string, TutorRow>;
  checkedInIds: Set<string>;
  closedTutorIds: Set<string>;
  isToday: boolean;
  pending: boolean;
  query: string;
  letter: string | null;
  onCheckIn: (tutor: TutorRow, scheduledShift: string) => void;
  onCheckOutByTutorId: (tutorId: string) => void;
};

export function RosterList({
  slots,
  nameToTutor,
  checkedInIds,
  closedTutorIds,
  isToday,
  pending,
  query,
  letter,
  onCheckIn,
  onCheckOutByTutorId,
}: Props) {
  const rows = useMemo(() => {
    const merged = getMergedShiftsForDay(slots);
    return merged.map((shift): RosterRow => {
      const tutor = nameToTutor.get(shift.name.toLowerCase());
      let status: Status = "scheduled";
      if (tutor) {
        if (checkedInIds.has(tutor.id)) status = "here";
        else if (closedTutorIds.has(tutor.id)) status = "done";
      }
      const letterChar = shift.name.trim().charAt(0).toUpperCase();
      return {
        ...shift,
        key: `${shift.name}-${shift.shiftLabel}`,
        tutor,
        status,
        letter: /[A-Z]/.test(letterChar) ? letterChar : "#",
      };
    });
  }, [slots, nameToTutor, checkedInIds, closedTutorIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (letter && row.letter !== letter) return false;
      if (!q) return true;
      if (row.name.toLowerCase().includes(q)) return true;
      return row.courses.some((c) => c.toLowerCase().includes(q));
    });
  }, [rows, query, letter]);

  if (rows.length === 0) {
    return (
      <section className="space-y-3" aria-labelledby="roster-heading">
        <Header count={0} />
        <p className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          No tutoring slots this day. Use Check in walk-in for arrivals.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4" aria-labelledby="roster-heading">
      <Header count={filtered.length} total={rows.length} />
      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
          No tutors match this search.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {filtered.map((row) => {
            const coursePreview = row.courses.slice(0, 2).join(", ");
            const extra = row.courses.length - 2;
            return (
              <li
                key={row.key}
                id={`tutor-${row.letter}-${row.name.toLowerCase().replace(/\s+/g, "-")}`}
                className="flex items-center justify-between gap-3 px-3 py-3 sm:px-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-medium text-slate-900">
                    {row.name}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {slotLabel(row.shiftLabel)}
                  </p>
                  {row.courses.length > 0 ? (
                    <p
                      className="mt-0.5 truncate text-xs text-slate-400"
                      title={row.courses.join(", ")}
                    >
                      {coursePreview}
                      {extra > 0 ? ` +${extra}` : ""}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={row.status} />
                  {row.tutor && isToday && row.status === "scheduled" ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onCheckIn(row.tutor!, row.shiftLabel)}
                      className="inline-flex min-h-11 min-w-[5.5rem] items-center justify-center rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-60"
                    >
                      Check in
                    </button>
                  ) : null}
                  {row.tutor && isToday && row.status === "here" ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onCheckOutByTutorId(row.tutor!.id)}
                      className="inline-flex min-h-11 min-w-[5.5rem] items-center justify-center rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-60"
                    >
                      Check out
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

/** Letters that have at least one tutor on the roster (for index chips). */
export function rosterLetters(slots: SlotMap): Set<string> {
  const set = new Set<string>();
  for (const shift of getMergedShiftsForDay(slots)) {
    const ch = shift.name.trim().charAt(0).toUpperCase();
    if (/[A-Z]/.test(ch)) set.add(ch);
  }
  return set;
}

function Header({ count, total }: { count: number; total?: number }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        Schedule
      </p>
      <h2
        id="roster-heading"
        className="font-display text-xl font-semibold text-slate-900"
      >
        Roster
      </h2>
      <p className="mt-0.5 text-sm text-slate-500">
        One row per tutor
        {total != null ? (
          <span className="tabular-nums">
            {" "}
            · showing {count}
            {count !== total ? ` of ${total}` : ""}
          </span>
        ) : null}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === "here") {
    return (
      <span
        className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800"
        aria-label="Status: here"
      >
        Here
      </span>
    );
  }
  if (status === "done") {
    return (
      <span
        className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
        aria-label="Status: done"
      >
        Done
      </span>
    );
  }
  return (
    <span
      className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900"
      aria-label="Status: due"
    >
      Due
    </span>
  );
}
