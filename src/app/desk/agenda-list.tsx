"use client";

import { useMemo } from "react";
import type { TutorRow } from "@/lib/attendance";
import { slotLabel } from "@/lib/schedule";
import type { SlotMap } from "./desk-types";

type Status = "scheduled" | "here" | "done";

type AgendaRow = {
  key: string;
  slot: string;
  name: string;
  courses: string[];
  tutor?: TutorRow;
  status: Status;
};

type Props = {
  slots: SlotMap;
  nameToTutor: Map<string, TutorRow>;
  checkedInIds: Set<string>;
  closedTutorIds: Set<string>;
  isToday: boolean;
  pending: boolean;
  onCheckIn: (tutor: TutorRow, scheduledShift: string) => void;
  onCheckOutByTutorId: (tutorId: string) => void;
};

export function AgendaList({
  slots,
  nameToTutor,
  checkedInIds,
  closedTutorIds,
  isToday,
  pending,
  onCheckIn,
  onCheckOutByTutorId,
}: Props) {
  const sections = useMemo(() => {
    const sorted = Object.keys(slots).sort();
    return sorted.map((slot) => {
      const rows: AgendaRow[] = slots[slot].map((entry, i) => {
        const tutor = nameToTutor.get(entry.name.toLowerCase());
        let status: Status = "scheduled";
        if (tutor) {
          if (checkedInIds.has(tutor.id)) status = "here";
          else if (closedTutorIds.has(tutor.id)) status = "done";
        }
        return {
          key: `${slot}-${entry.name}-${i}`,
          slot,
          name: entry.name,
          courses: entry.courses,
          tutor,
          status,
        };
      });
      return { slot, rows };
    });
  }, [slots, nameToTutor, checkedInIds, closedTutorIds]);

  if (sections.length === 0) {
    return (
      <section className="space-y-3">
        <Header />
        <p className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          No tutoring slots this day. Use Check in walk-in for arrivals.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <Header />
      <div className="space-y-5">
        {sections.map(({ slot, rows }) => (
          <div key={slot}>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-700">
                {slotLabel(slot)}
              </h3>
              <span className="text-xs tabular-nums text-slate-400">
                {rows.length} tutor{rows.length === 1 ? "" : "s"}
              </span>
            </div>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {rows.map((row) => (
                <li
                  key={row.key}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 sm:px-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {row.name}
                    </p>
                    <p className="truncate text-[11px] text-slate-400">
                      {row.courses.slice(0, 4).join(", ")}
                      {row.courses.length > 4 ? "…" : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={row.status} />
                    {row.tutor && isToday && row.status === "scheduled" ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => onCheckIn(row.tutor!, row.slot)}
                        className="rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                      >
                        Check in
                      </button>
                    ) : null}
                    {row.tutor && isToday && row.status === "here" ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => onCheckOutByTutorId(row.tutor!.id)}
                        className="rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        Out
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function Header() {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        Schedule
      </p>
      <h2 className="font-display text-xl font-semibold text-slate-900">
        Agenda
      </h2>
      <p className="mt-0.5 text-sm text-slate-500">
        One row per tutor — no overlapping blocks.
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === "here") {
    return (
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
        Here
      </span>
    );
  }
  if (status === "done") {
    return (
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
        Done
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
      Due
    </span>
  );
}
