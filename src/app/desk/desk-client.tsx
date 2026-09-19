"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { TutorRow } from "@/lib/attendance";
import {
  bucketShiftsForDesk,
  getMergedShiftsForDay,
} from "@/lib/schedule";
import { CheckInPanels } from "./check-in-panels";
import type { DeskClientProps } from "./desk-types";
import { DueNowBoard, LaterToday } from "./due-now-board";
import { HereNowBoard } from "./here-now-board";
import { OpsBar } from "./ops-bar";
import { useDeskLive } from "./use-desk-live";

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

  const [searchSeed, setSearchSeed] = useState("");
  const [laterOpenDone, setLaterOpenDone] = useState(false);

  const nameToTutor = useMemo(() => {
    const map = new Map<string, TutorRow>();
    for (const t of tutors) map.set(t.name.toLowerCase(), t);
    return map;
  }, [tutors]);

  const nameToTutorId = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tutors) map.set(t.name.toLowerCase(), t.id);
    return map;
  }, [tutors]);

  const boards = useMemo(() => {
    const shifts = getMergedShiftsForDay(slots);
    if (!isToday) {
      const later = shifts.map((s) => ({
        ...s,
        status: "upcoming" as const,
      }));
      return { dueNow: [], later, done: [] };
    }
    return bucketShiftsForDesk(
      shifts,
      live.nowMin,
      live.checkedInIds,
      live.closedIntervals,
      nameToTutorId,
    );
  }, [
    slots,
    isToday,
    live.nowMin,
    live.checkedInIds,
    live.closedIntervals,
    nameToTutorId,
  ]);

  useEffect(() => {
    setSearchSeed("");
    setLaterOpenDone(false);
  }, [date, dayKey]);

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
      <OpsBar
        date={date}
        today={today}
        isToday={isToday}
        week={week}
        slots={slots}
        tutors={tutors}
        checkedInIds={live.checkedInIds}
        onCheckIn={(t, shift) => live.checkInTutor(t, shift)}
        onWalkIn={live.openTutorPanel}
        onAddStudent={() => live.openStudentPanel()}
        isPending={live.isPending}
      />

      {!isToday ? (
        <div
          className="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 lg:mx-6"
          role="status"
        >
          Viewing schedule for {date}.{" "}
          <Link
            href={`/desk?date=${today}`}
            className="font-semibold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            Switch to Today
          </Link>{" "}
          to check people in.
        </div>
      ) : null}

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {live.toast ?? ""}
      </div>
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {live.error ?? ""}
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
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2 lg:gap-10">
          <HereNowBoard
            openTutors={live.openTutors}
            visitsByTutorId={live.visitsByTutorId}
            highlightId={live.highlightId}
            isToday={isToday}
            isPending={live.isPending}
            onCheckOut={(id) => live.checkOutTutor(id)}
            onAddStudent={(tutorId) => live.openStudentPanel(tutorId)}
            onCheckOutStudent={live.checkOutStudent}
          />

          <div className="space-y-6">
            <DueNowBoard
              rows={boards.dueNow}
              nameToTutor={nameToTutor}
              isToday={isToday}
              isPending={live.isPending}
              onCheckIn={live.checkInTutor}
            />

            <LaterToday
              rows={boards.later}
              nameToTutor={nameToTutor}
              isToday={isToday}
              isPending={live.isPending}
              onCheckIn={live.checkInTutor}
            />

            {boards.done.length > 0 ? (
              <details
                className="rounded-2xl border border-slate-200 bg-white"
                open={laterOpenDone}
                onToggle={(e) =>
                  setLaterOpenDone((e.target as HTMLDetailsElement).open)
                }
              >
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-slate-600 [&::-webkit-details-marker]:hidden">
                  Done today
                  <span className="tabular-nums font-normal text-slate-400">
                    {boards.done.length}
                  </span>
                </summary>
                <ul className="divide-y divide-slate-100 border-t border-slate-100">
                  {boards.done.map((row) => (
                    <li
                      key={`${row.name}-${row.shiftLabel}`}
                      className="px-4 py-2.5 text-sm text-slate-500"
                    >
                      <span className="font-medium text-slate-700">
                        {row.name}
                      </span>
                      <span className="text-slate-400">
                        {" "}
                        · {row.shiftLabel}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 bg-white px-4 py-3 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-700">
            In now: {live.openTutors.length} tutor
            {live.openTutors.length === 1 ? "" : "s"} · {live.openStudentCount}{" "}
            student{live.openStudentCount === 1 ? "" : "s"}
          </p>
          <Link
            href="/desk/export"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            Export Excel →
          </Link>
        </div>
      </div>

      <CheckInPanels
        panel={live.panel}
        onClose={() => live.setPanel("none")}
        tutors={tutors}
        openTutors={live.openTutors}
        checkedInIds={live.checkedInIds}
        isToday={isToday}
        isPending={live.isPending}
        defaultTutorId={live.defaultTutorId}
        initialQuery={searchSeed}
        onCheckIn={(t) => live.checkInTutor(t)}
        onAddStudent={live.addStudent}
      />
    </div>
  );
}
