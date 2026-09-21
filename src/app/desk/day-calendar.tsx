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
import {
  formatShiftRange,
  shiftToMinutes,
} from "@/lib/shift-time";

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
  isPending: (key: string) => boolean;
  onCheckIn: (tutor: TutorRow, scheduledShift: string) => void;
};

function assignLanes(
  blocks: Omit<CalendarBlock, "lane" | "laneCount">[],
): CalendarBlock[] {
  const sorted = [...blocks].sort(
    (a, b) => a.startMin - b.startMin || a.endMin - b.endMin || a.name.localeCompare(b.name),
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

  // laneCount = max concurrent lanes used in the day (for width)
  const maxLane = Math.max(0, ...withLane.map((b) => b.lane)) + 1;
  return withLane.map((b) => ({ ...b, laneCount: maxLane }));
}

function minutesLabel(mins: number): string {
  let h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return m === 0 ? `${h} ${suffix}` : `${h}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function DayCalendar({
  shifts,
  attendance,
  nameToTutor,
  checkedInIds,
  isToday,
  isPending,
  onCheckIn,
}: Props) {
  const rangeStart = TIMELINE_START_MIN;
  const rangeEnd = TIMELINE_END_MIN;
  const totalMin = rangeEnd - rangeStart;
  const heightPx = totalMin * TIMELINE_PX_PER_MIN;

  const blocks = useMemo(() => {
    const byKey = new Map<string, Omit<CalendarBlock, "lane" | "laneCount">>();

    // Roster shifts from schedule.json
    for (const s of shifts) {
      const tutor = nameToTutor.get(s.name.toLowerCase());
      const here = tutor ? checkedInIds.has(tutor.id) : false;
      const attForTutor = attendance.filter(
        (a) =>
          a.tutor_id === tutor?.id ||
          a.tutors?.name?.toLowerCase() === s.name.toLowerCase(),
      );
      const done = attForTutor.some((a) => a.time_out);
      const open = attForTutor.find((a) => !a.time_out);
      const status: CalendarBlock["status"] = here || open ? "here" : done ? "done" : "scheduled";
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
        attendanceId: open?.id ?? attForTutor[0]?.id,
        timeInLabel: open?.time_in
          ? undefined
          : attForTutor[0]?.time_in
            ? undefined
            : undefined,
      });
    }

    // Attendance rows with off-hour / walk-in scheduled shifts not in roster
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

      // Skip if a roster block already covers same tutor + overlapping window
      const covered = [...byKey.values()].some(
        (b) =>
          b.name.toLowerCase() === name.toLowerCase() &&
          b.startMin < parsed.endMin &&
          b.endMin > parsed.startMin &&
          Math.abs(b.startMin - parsed.startMin) < 20,
      );

      const status: CalendarBlock["status"] = !row.time_out
        ? "here"
        : "done";
      const key = `att:${row.id}`;

      if (covered) {
        // Enrich matching roster block with actual time_in
        for (const [k, b] of byKey) {
          if (
            b.name.toLowerCase() === name.toLowerCase() &&
            b.startMin < parsed.endMin &&
            b.endMin > parsed.startMin
          ) {
            byKey.set(k, {
              ...b,
              status,
              attendanceId: row.id,
              timeInLabel: row.time_in
                ? formatClockShort(row.time_in)
                : undefined,
              // Prefer Excel/imported range when it differs meaningfully
              startMin:
                Math.abs(parsed.startMin - b.startMin) >= 15
                  ? parsed.startMin
                  : b.startMin,
              endMin:
                Math.abs(parsed.endMin - b.endMin) >= 15
                  ? parsed.endMin
                  : b.endMin,
              shiftLabel:
                shiftToMinutes(row.scheduled_shift)?.startMin != null
                  ? row.scheduled_shift || b.shiftLabel
                  : b.shiftLabel,
            });
          }
        }
        continue;
      }

      byKey.set(key, {
        key,
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

    return assignLanes([...byKey.values()].filter(
      (b) => b.endMin > rangeStart && b.startMin < rangeEnd,
    ));
  }, [
    shifts,
    attendance,
    nameToTutor,
    checkedInIds,
    rangeStart,
    rangeEnd,
  ]);

  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let m = rangeStart; m <= rangeEnd; m += 30) out.push(m);
    return out;
  }, [rangeStart, rangeEnd]);

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
          className="relative min-w-[320px]"
          style={{ height: heightPx + 24 }}
        >
          {/* Time gutter + grid lines */}
          <div className="absolute inset-y-0 left-0 w-16 border-r border-slate-100 bg-slate-50/80 pt-3">
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

          <div className="absolute inset-y-0 left-16 right-0 pt-3 pr-3">
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
                28,
                (bottomMin - Math.max(b.startMin, rangeStart)) *
                  TIMELINE_PX_PER_MIN -
                  2,
              );
              const widthPct = 100 / b.laneCount;
              const leftPct = b.lane * widthPct;
              const pending =
                b.tutor && isPending(`in:${b.tutor.id}`);
              const canCheckIn =
                isToday &&
                b.tutor &&
                b.status === "scheduled" &&
                !checkedInIds.has(b.tutor.id);

              const tone =
                b.status === "here"
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : b.status === "done"
                    ? "border-slate-200 bg-slate-100 text-slate-700"
                    : "border-emerald-200 bg-emerald-50 text-slate-900";

              return (
                <div
                  key={b.key}
                  className={`absolute overflow-hidden rounded-lg border px-2 py-1.5 shadow-sm ${tone}`}
                  style={{
                    top,
                    height,
                    left: `calc(${leftPct}% + 4px)`,
                    width: `calc(${widthPct}% - 8px)`,
                  }}
                  title={`${b.name} · ${formatShiftRange(b.shiftLabel)}`}
                >
                  <div className="flex h-full min-h-0 flex-col gap-0.5">
                    <div className="flex items-start justify-between gap-1">
                      <p className="min-w-0 text-xs font-semibold leading-snug">
                        {b.name}
                      </p>
                      <span
                        className={`shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
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
                            : "Sched"}
                      </span>
                    </div>
                    <p
                      className={`text-[11px] tabular-nums leading-snug ${
                        b.status === "here" ? "text-emerald-50" : "text-slate-500"
                      }`}
                    >
                      {formatShiftRange(b.shiftLabel)}
                      {b.timeInLabel ? ` · in ${b.timeInLabel}` : ""}
                    </p>
                    {b.courses.length > 0 && height > 48 ? (
                      <p
                        className={`line-clamp-2 text-[10px] leading-snug break-words ${
                          b.status === "here"
                            ? "text-emerald-100/90"
                            : "text-slate-400"
                        }`}
                      >
                        {b.courses.join(", ")}
                      </p>
                    ) : null}
                    {canCheckIn ? (
                      <button
                        type="button"
                        disabled={!!pending}
                        onClick={() =>
                          onCheckIn(b.tutor!, b.shiftLabel)
                        }
                        className="mt-auto inline-flex min-h-8 items-center justify-center rounded-md bg-emerald-600 px-2 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
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

function minutesPad(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatClockShort(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Beirut",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}
