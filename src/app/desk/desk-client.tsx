"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { TutorRow } from "@/lib/attendance";
import { formatClock, formatDurationMinutes } from "@/lib/schedule";
import { CheckInPanels } from "./check-in-panels";
import type { DeskClientProps } from "./desk-types";
import { HereNowBoard } from "./here-now-board";
import { RosterList, rosterLetters } from "./roster-list";
import { TutorIndex } from "./tutor-index";
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

  const [query, setQuery] = useState("");
  const [letter, setLetter] = useState<string | null>(null);

  const nameToTutor = useMemo(() => {
    const map = new Map<string, TutorRow>();
    for (const t of tutors) map.set(t.name.toLowerCase(), t);
    return map;
  }, [tutors]);

  const openByTutorId = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of live.openTutors) map.set(a.tutor_id, a.id);
    return map;
  }, [live.openTutors]);

  const activeLetters = useMemo(() => rosterLetters(slots), [slots]);

  // Reset filters when the day changes
  useEffect(() => {
    setQuery("");
    setLetter(null);
  }, [date, dayKey]);

  // Esc closes slide-over panels
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && live.panel !== "none") {
        live.setPanel("none");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [live.panel, live.setPanel]);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <WeekStrip
        date={date}
        today={today}
        isToday={isToday}
        week={week}
        onCheckIn={live.openTutorPanel}
        onAddStudent={() => live.openStudentPanel()}
      />

      <TutorIndex
        query={query}
        onQueryChange={setQuery}
        letter={letter}
        onLetterChange={setLetter}
        activeLetters={activeLetters}
        onCheckIn={live.openTutorPanel}
        onAddStudent={() => live.openStudentPanel()}
      />

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {live.toast ?? live.error ?? ""}
      </div>

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
        <div className="mx-auto max-w-3xl space-y-10">
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

          <RosterList
            slots={slots}
            nameToTutor={nameToTutor}
            checkedInIds={live.checkedInIds}
            closedTutorIds={live.closedTutorIds}
            isToday={isToday}
            pending={live.pending}
            query={query}
            letter={letter}
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
            {live.openTutors.length === 1 ? "" : "s"} · {live.openStudentCount}{" "}
            student{live.openStudentCount === 1 ? "" : "s"}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={live.openTutorPanel}
              className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:hidden"
            >
              Walk-in
            </button>
            <button
              type="button"
              onClick={() => live.openStudentPanel()}
              className="inline-flex min-h-11 items-center rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:hidden"
            >
              Student
            </button>
            <Link
              href="/desk/export"
              className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
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
                    className="min-h-8 min-w-8 font-semibold text-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                  >
                    Out
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
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
        initialQuery={query}
        onCheckIn={(t) => live.checkInTutor(t)}
        onAddStudent={live.addStudent}
      />
    </div>
  );
}
