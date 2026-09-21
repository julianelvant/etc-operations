"use client";

import { useMemo } from "react";
import type { TutorAttendanceRow, TutorRow } from "@/lib/attendance";
import {
  TIMELINE_END_MIN,
  TIMELINE_PX_PER_MIN,
  TIMELINE_START_MIN,
  beirutMinutes,
  type MergedShift,
} from "@/lib/schedule";
import { formatShiftRange, shiftToMinutes } from "@/lib/shift-time";

export type CalendarBlock = {
  key: string;
  name: string;
  tutorId?: string;
  tutor?: TutorRow;
  courses: string[];
  startMin: number;
  endMin: number;
  shiftLabel: string;
  status: "scheduled" | "here" | "done";
  attendanceId?: string;
  timeInLabel?: string;
  lane: number;
  laneCount: number;
};

type Props = {
  shifts: MergedShift[];
  attendance: TutorAttendanceRow[];
  nameToTutor: Map<string, TutorRow>;
  checkedInIds: Set<string>;
  isToday: boolean;
  isPending?: (key: string) => boolean;
  onCheckIn?: (tutor: TutorRow, scheduledShift: string) => void;
  /** Admin / read-only: hide check-in controls */
  readOnly?: boolean;
};

const LANE_MIN_PX = 232;

function assignLanes(
  blocks: Omit<CalendarBlock, "lane" | "laneCount">[],
): CalendarBlock[] {
  const sorted = [...blocks].sort(
    (a, b) =>
      a.startMin - b.startMin ||
      a.endMin - b.endMin ||
      a.name.localeCompare(b.name),
  );
  const laneEnds: number[] = [];
  const withLane: CalendarBlock[] = [];

  for (const b of sorted) {
    let lane = laneEnds.findIndex((end) => end <= b.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(b.endMin);
    } else {
      laneEnds[lane] = b.endMin;
    }
    withLane.push({ ...b, lane, laneCount: 1 });
  }

  const maxLane = Math.max(0, ...withLane.map((b) => b.lane)) + 1;
  return withLane.map((b) => ({ ...b, laneCount: maxLane }));
}

function minutesLabel(mins: number): string {
  let h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return m === 0
    ? `${h} ${suffix}`
    : `${h}:${String(m).padStart(2, "0")} ${suffix}`;
}

function minutesPad(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatClockShort(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Beirut",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function DayCalendar({
  shifts,
  attendance,
  nameToTutor,
  checkedInIds,
  isToday,
  isPending = () => false,
  onCheckIn,
  readOnly = false,
}: Props) {
  const rangeStart = TIMELINE_START_MIN;
  const rangeEnd = TIMELINE_END_MIN;
  const totalMin = rangeEnd - rangeStart;
  const heightPx = totalMin * TIMELINE_PX_PER_MIN;

  const blocks = useMemo(() => {
    const byKey = new Map<string, Omit<CalendarBlock, "lane" | "laneCount">>();

    for (const s of shifts) {
      const tutor = nameToTutor.get(s.name.toLowerCase());
      const attForTutor = attendance.filter(
        (a) =>
          a.tutor_id === tutor?.id ||
          a.tutors?.name?.toLowerCase() === s.name.toLowerCase(),
      );
      const done = attForTutor.some((a) => a.time_out);
      const open = attForTutor.find((a) => !a.time_out);
      const here = tutor ? checkedInIds.has(tutor.id) : Boolean(open);
      const status: CalendarBlock["status"] =
        here || open ? "here" : done ? "done" : "scheduled";
      const sample = open ?? attForTutor[0];
      const key = `sched:${s.name}:${s.shiftLabel}`;
      byKey.set(key, {
        key,
        name: s.name,
        tutorId: tutor?.id,
        tutor,
        courses: s.courses,
        startMin: s.start,
        endMin: s.end,
        shiftLabel: s.shiftLabel,
        status,
        attendanceId: sample?.id,
        timeInLabel: sample?.time_in
          ? formatClockShort(sample.time_in)
          : undefined,
      });
    }

    for (const row of attendance) {
      const name = row.tutors?.name ?? "Tutor";
      const parsed =
        shiftToMinutes(row.scheduled_shift) ??
        (() => {
          if (!row.time_in) return null;
          const start = beirutMinutes(row.time_in);
          const end = row.time_out
            ? beirutMinutes(row.time_out)
            : Math.min(start + 60, rangeEnd);
          if (!(end > start)) return null;
          return { startMin: start, endMin: end };
        })();
      if (!parsed) continue;

      const covered = [...byKey.values()].some(
        (b) =>
          b.name.toLowerCase() === name.toLowerCase() &&
          b.startMin < parsed.endMin &&
          b.endMin > parsed.startMin,
      );

      const status: CalendarBlock["status"] = !row.time_out ? "here" : "done";

      if (covered) {
        // Prefer a single enriched roster block (import may be half-hour off)
        let bestKey: string | null = null;
        let bestOverlap = 0;
        for (const [k, b] of byKey) {
          if (b.name.toLowerCase() !== name.toLowerCase()) continue;
          const overlap =
            Math.min(b.endMin, parsed.endMin) -
            Math.max(b.startMin, parsed.startMin);
          if (overlap > bestOverlap) {
            bestOverlap = overlap;
            bestKey = k;
          }
        }
        if (bestKey) {
          const b = byKey.get(bestKey)!;
          byKey.set(bestKey, {
            ...b,
            status,
            attendanceId: row.id,
            timeInLabel: row.time_in
              ? formatClockShort(row.time_in)
              : b.timeInLabel,
            startMin: parsed.startMin,
            endMin: parsed.endMin,
            shiftLabel:
              (row.scheduled_shift &&
                shiftToMinutes(row.scheduled_shift) &&
                row.scheduled_shift) ||
              b.shiftLabel,
          });
        }
        continue;
      }

      byKey.set(`att:${row.id}`, {
        key: `att:${row.id}`,
        name,
        tutorId: row.tutor_id,
        tutor: nameToTutor.get(name.toLowerCase()),
        courses: row.tutors?.courses ?? [],
        startMin: parsed.startMin,
        endMin: parsed.endMin,
        shiftLabel:
          row.scheduled_shift ||
          `${minutesPad(parsed.startMin)}-${minutesPad(parsed.endMin)}`,
        status,
        attendanceId: row.id,
        timeInLabel: row.time_in ? formatClockShort(row.time_in) : undefined,
      });
    }

    return assignLanes(
      [...byKey.values()].filter(
        (b) => b.endMin > rangeStart && b.startMin < rangeEnd,
      ),
    );
  }, [shifts, attendance, nameToTutor, checkedInIds, rangeStart, rangeEnd]);

  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let m = rangeStart; m <= rangeEnd; m += 30) out.push(m);
    return out;
  }, [rangeStart, rangeEnd]);

  const laneCount = Math.max(1, ...blocks.map((b) => b.laneCount));
  const gridWidthPx = Math.max(laneCount * LANE_MIN_PX, 520);

  return (
    <section className="space-y-3" aria-labelledby="day-calendar-heading">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Full day
          </p>
          <h2
            id="day-calendar-heading"
            className="font-display text-xl font-semibold text-slate-900"
          >
            Today&apos;s calendar
          </h2>
        </div>
        <p className="text-sm tabular-nums text-slate-500">
          {blocks.length} block{blocks.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <div
          className="relative"
          style={{ height: heightPx + 24, minWidth: gridWidthPx + 64 }}
        >
          <div className="absolute inset-y-0 left-0 z-10 w-16 border-r border-slate-100 bg-slate-50/95 pt-3">
            {ticks.map((m) => (
              <div
                key={m}
                className="absolute right-2 -translate-y-1/2 text-[11px] font-medium tabular-nums text-slate-500"
                style={{ top: 12 + (m - rangeStart) * TIMELINE_PX_PER_MIN }}
              >
                {minutesLabel(m)}
              </div>
            ))}
          </div>

          <div
            className="absolute inset-y-0 left-16 pt-3 pr-3"
            style={{ width: gridWidthPx }}
          >
            {ticks.map((m) => (
              <div
                key={`line-${m}`}
                className={`absolute left-0 right-0 border-t ${
                  m % 60 === 0 ? "border-slate-200" : "border-slate-100"
                }`}
                style={{ top: 12 + (m - rangeStart) * TIMELINE_PX_PER_MIN }}
              />
            ))}

            {blocks.map((b) => {
              const top =
                12 +
                (Math.max(b.startMin, rangeStart) - rangeStart) *
                  TIMELINE_PX_PER_MIN;
              const bottomMin = Math.min(b.endMin, rangeEnd);
              const height = Math.max(
                56,
                (bottomMin - Math.max(b.startMin, rangeStart)) *
                  TIMELINE_PX_PER_MIN -
                  6,
              );
              const leftPx = b.lane * LANE_MIN_PX + 6;
              const widthPx = LANE_MIN_PX - 12;
              const pending = b.tutor && isPending(`in:${b.tutor.id}`);
              const canCheckIn =
                !readOnly &&
                isToday &&
                Boolean(onCheckIn) &&
                b.tutor &&
                b.status === "scheduled" &&
                !checkedInIds.has(b.tutor.id);

              const tone =
                b.status === "here"
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : b.status === "done"
                    ? "border-slate-200 bg-slate-50 text-slate-800"
                    : "border-emerald-200 bg-emerald-50 text-slate-900";

              return (
                <div
                  key={b.key}
                  className={`absolute rounded-xl border px-3 py-2 shadow-sm ${tone}`}
                  style={{ top, height, left: leftPx, width: widthPx }}
                  title={`${b.name} · ${formatShiftRange(b.shiftLabel)}`}
                >
                  <div className="flex h-full min-h-0 flex-col gap-1.5 overflow-y-auto">
                    <p className="text-sm font-semibold leading-snug break-words">
                      {b.name}
                    </p>
                    <p
                      className={`text-xs tabular-nums leading-snug break-words ${
                        b.status === "here"
                          ? "text-emerald-50"
                          : "text-slate-600"
                      }`}
                    >
                      {formatShiftRange(b.shiftLabel)}
                      {b.timeInLabel ? (
                        <span className="block opacity-90">
                          in {b.timeInLabel}
                        </span>
                      ) : null}
                    </p>
                    <span
                      className={`w-fit rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        b.status === "here"
                          ? "bg-white/20 text-white"
                          : b.status === "done"
                            ? "bg-slate-200 text-slate-600"
                            : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {b.status === "here"
                        ? "Here"
                        : b.status === "done"
                          ? "Done"
                          : "Scheduled"}
                    </span>
                    {b.courses.length > 0 && height > 110 ? (
                      <p
                        className={`line-clamp-2 text-[11px] leading-snug break-words ${
                          b.status === "here"
                            ? "text-emerald-100/90"
                            : "text-slate-500"
                        }`}
                      >
                        {b.courses.join(", ")}
                      </p>
                    ) : null}
                    {canCheckIn ? (
                      <button
                        type="button"
                        disabled={!!pending}
                        onClick={() => onCheckIn?.(b.tutor!, b.shiftLabel)}
                        className="mt-auto inline-flex min-h-9 shrink-0 items-center justify-center rounded-md bg-emerald-600 px-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                      >
                        Check in
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
