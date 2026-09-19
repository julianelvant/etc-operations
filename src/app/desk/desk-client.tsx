"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { TutorRow } from "@/lib/attendance";
import {
  formatClock,
  formatDurationMinutes,
  slotLabel,
} from "@/lib/schedule";
import { AgendaList } from "./agenda-list";
import { CheckInPanels } from "./check-in-panels";
import type { DeskClientProps } from "./desk-types";
import { HereNowBoard } from "./here-now-board";
import { useDeskLive } from "./use-desk-live";
import { WeekStrip } from "./week-strip";

export function DeskClient({
  date,
  today,
  dayKey,
  isToday,
  slots,
  week,
  tutors,
  initialAttendance,
  initialVisits,
}: DeskClientProps) {
  const live = useDeskLive({
    date,
    isToday,
    initialAttendance,
    initialVisits,
  });

  const nameToTutor = useMemo(() => {
    const map = new Map<string, TutorRow>();
    for (const t of tutors) map.set(t.name.toLowerCase(), t);
    return map;
  }, [tutors]);

  const sortedSlots = useMemo(() => Object.keys(slots).sort(), [slots]);

  const openByTutorId = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of live.openTutors) map.set(a.tutor_id, a.id);
    return map;
  }, [live.openTutors]);

  return (
    <div className="flex min-h-0 w-full flex-1">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white xl:flex">
        <div className="border-b border-slate-100 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Courses
          </p>
          <h2 className="mt-1 font-display text-lg font-semibold text-slate-900">
            {dayKey.charAt(0).toUpperCase() + dayKey.slice(1)}
          </h2>
          <p className="text-sm text-slate-500">{date}</p>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {sortedSlots.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500">
              No tutoring slots this day.
            </p>
          ) : (
            <div className="space-y-4">
              {sortedSlots.map((slot) => (
                <div key={slot}>
                  <p className="mb-2 px-1 text-xs font-semibold text-slate-500">
                    {slotLabel(slot)}
                  </p>
                  <ul className="space-y-1">
                    {slots[slot].map((entry) => {
                      const tutor = nameToTutor.get(entry.name.toLowerCase());
                      const isIn = tutor
                        ? live.checkedInIds.has(tutor.id)
                        : false;
                      return (
                        <li
                          key={`${slot}-${entry.name}`}
                          className="rounded-lg px-2 py-1.5"
                        >
                          <p
                            className={`truncate text-sm font-medium ${
                              isIn ? "text-emerald-700" : "text-slate-800"
                            }`}
                          >
                            {entry.name}
                            {isIn ? " · in" : ""}
                          </p>
                          <p className="truncate text-[11px] text-slate-400">
                            {entry.courses.slice(0, 3).join(", ")}
                            {entry.courses.length > 3 ? "…" : ""}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-2 border-t border-slate-100 p-3">
          <button
            type="button"
            onClick={live.openTutorPanel}
            className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Check in walk-in
          </button>
          <button
            type="button"
            onClick={() => live.openStudentPanel()}
            className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Add student
          </button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <WeekStrip
          date={date}
          today={today}
          isToday={isToday}
          week={week}
          onCheckIn={live.openTutorPanel}
          onAddStudent={() => live.openStudentPanel()}
        />

        {(live.toast || live.error) && (
          <div
            className={`mx-4 mt-3 rounded-xl px-4 py-2.5 text-sm lg:mx-6 ${
              live.error
                ? "bg-rose-50 text-rose-700"
                : "bg-emerald-50 text-emerald-800"
            }`}
          >
            {live.error ?? live.toast}
          </div>
        )}

        <div className="relative flex-1 overflow-y-auto px-4 py-5 lg:px-6">
          <div className="mx-auto max-w-5xl space-y-10">
            <HereNowBoard
              openTutors={live.openTutors}
              visitsByTutorId={live.visitsByTutorId}
              highlightId={live.highlightId}
              isToday={isToday}
              pending={live.pending}
              onCheckOut={live.checkOutTutor}
              onAddStudent={(tutorId) => live.openStudentPanel(tutorId)}
              onCheckOutStudent={live.checkOutStudent}
            />

            <AgendaList
              slots={slots}
              nameToTutor={nameToTutor}
              checkedInIds={live.checkedInIds}
              closedTutorIds={live.closedTutorIds}
              isToday={isToday}
              pending={live.pending}
              onCheckIn={live.checkInTutor}
              onCheckOutByTutorId={(tutorId) => {
                const id = openByTutorId.get(tutorId);
                if (id) live.checkOutTutor(id);
              }}
            />
          </div>
        </div>

        <div className="border-t border-slate-200 bg-white px-4 py-3 lg:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-700">
              In now: {live.openTutors.length} tutor
              {live.openTutors.length === 1 ? "" : "s"} ·{" "}
              {live.openStudentCount} student
              {live.openStudentCount === 1 ? "" : "s"}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={live.openTutorPanel}
                className="hidden text-sm font-semibold text-slate-600 hover:text-slate-900 sm:inline lg:hidden"
              >
                Walk-in
              </button>
              <Link
                href="/desk/export"
                className="text-sm font-semibold text-emerald-700 hover:underline"
              >
                Export Excel →
              </Link>
            </div>
          </div>
          {live.visits.length > 0 ? (
            <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {live.visits.map((v) => (
                <li
                  key={v.id}
                  className="flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs"
                >
                  <span className="font-medium text-slate-800">
                    {v.student_name}
                  </span>
                  <span className="text-slate-400">
                    {formatClock(v.time_in)}
                    {v.time_out
                      ? `–${formatClock(v.time_out)} (${formatDurationMinutes(v.duration_minutes)})`
                      : ""}
                  </span>
                  {!v.time_out && isToday ? (
                    <button
                      type="button"
                      onClick={() => live.checkOutStudent(v.id)}
                      className="font-semibold text-emerald-700"
                    >
                      Out
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </main>

      {/* Mobile sticky actions */}
      <div className="fixed right-4 bottom-4 z-30 flex flex-col gap-2 xl:hidden">
        <button
          type="button"
          onClick={() => live.openStudentPanel()}
          className="rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-200"
        >
          Add student
        </button>
        <button
          type="button"
          onClick={live.openTutorPanel}
          className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-lg"
        >
          Check in
        </button>
      </div>

      <CheckInPanels
        panel={live.panel}
        onClose={() => live.setPanel("none")}
        tutors={tutors}
        openTutors={live.openTutors}
        checkedInIds={live.checkedInIds}
        isToday={isToday}
        pending={live.pending}
        defaultTutorId={live.defaultTutorId}
        onCheckIn={(t) => live.checkInTutor(t)}
        onAddStudent={live.addStudent}
      />
    </div>
  );
}
