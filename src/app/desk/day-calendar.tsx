"use client";

import { useMemo } from "react";
import type { TutorAttendanceRow, TutorRow } from "@/lib/attendance";
import {
  TIMELINE_END_MIN,
  TIMELINE_START_MIN,
  beirutMinutes,
  type MergedShift,
  type ShiftRole,
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
  role: ShiftRole;
  isRecurring: boolean;
  attendanceId?: string;
  timeInLabel?: string;
};

type Props = {
  date: string;
  shifts: MergedShift[];
  attendance: TutorAttendanceRow[];
  nameToTutor: Map<string, TutorRow>;
  checkedInIds: Set<string>;
  isToday: boolean;
  isPending?: (key: string) => boolean;
  onCheckIn?: (tutor: TutorRow, scheduledShift: string) => void;
  readOnly?: boolean;
  onEditAttendance?: (attendanceId: string) => void;
};

const LABEL_COL_PX = 176;
const TIMELINE_MIN_WIDTH_PX = 640;

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

function formatDateHeading(date: string, isToday: boolean): string {
  if (isToday) return "Today's calendar";
  const label = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Beirut",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T12:00:00+03:00`));
  return `Schedule for ${label}`;
}

function RoleBadge({ role }: { role: ShiftRole }) {
  if (role === "Tutor") return null;
  const tone =
    role === "TA"
      ? "bg-slate-700 text-white"
      : role === "Coordinator"
        ? "bg-brand/15 text-brand-ink"
        : "bg-slate-100 text-slate-700";
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`}
    >
      {role}
    </span>
  );
}

function roleRailClass(
  role: ShiftRole,
  status: CalendarBlock["status"],
): string {
  if (status === "here") {
    return "border-l-[3px] border-l-[var(--status-here-border)]";
  }
  if (role === "TA") return "border-l-[3px] border-l-slate-600";
  if (role === "Coordinator") return "border-l-[3px] border-l-brand";
  return "border-l-[3px] border-l-transparent";
}

function barPosition(
  startMin: number,
  endMin: number,
  rangeStart: number,
  rangeEnd: number,
) {
  const span = rangeEnd - rangeStart;
  const left = ((Math.max(startMin, rangeStart) - rangeStart) / span) * 100;
  const right = ((rangeEnd - Math.min(endMin, rangeEnd)) / span) * 100;
  return {
    left: `${left}%`,
    right: `${right}%`,
  };
}

export function DayCalendar({
  date,
  shifts,
  attendance,
  nameToTutor,
  checkedInIds,
  isToday,
  isPending = () => false,
  onCheckIn,
  readOnly = false,
  onEditAttendance,
}: Props) {
  const rangeStart = TIMELINE_START_MIN;
  const rangeEnd = TIMELINE_END_MIN;

  const blocks = useMemo(() => {
    const byKey = new Map<string, CalendarBlock>();

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
      const attRole = open?.role || sample?.role;
      const role: ShiftRole =
        attRole && ["Tutor", "TA", "Coordinator", "Other"].includes(attRole)
          ? (attRole as ShiftRole)
          : s.role;
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
        role,
        isRecurring: s.isRecurring,
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
      const role: ShiftRole = ["Tutor", "TA", "Coordinator", "Other"].includes(
        row.role,
      )
        ? (row.role as ShiftRole)
        : "Tutor";

      if (covered) {
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
            role,
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
        role,
        isRecurring: false,
        attendanceId: row.id,
        timeInLabel: row.time_in ? formatClockShort(row.time_in) : undefined,
      });
    }

    return [...byKey.values()]
      .filter((b) => b.endMin > rangeStart && b.startMin < rangeEnd)
      .sort(
        (a, b) =>
          a.startMin - b.startMin ||
          a.endMin - b.endMin ||
          a.name.localeCompare(b.name),
      );
  }, [shifts, attendance, nameToTutor, checkedInIds, rangeStart, rangeEnd]);

  const hourTicks = useMemo(() => {
    const out: number[] = [];
    for (let m = rangeStart; m <= rangeEnd; m += 60) out.push(m);
    return out;
  }, [rangeStart, rangeEnd]);

  const hasTa = blocks.some((b) => b.role === "TA");

  return (
    <section className="space-y-3" aria-labelledby="day-calendar-heading">
      <div>
        <h2
          id="day-calendar-heading"
          className="font-display text-xl font-semibold text-ink"
        >
          {formatDateHeading(date, isToday)}
        </h2>
        <p className="mt-0.5 text-sm text-muted">
          {blocks.length} shift{blocks.length === 1 ? "" : "s"} · scroll
          sideways on small screens for the timeline
          {hasTa ? (
            <>
              {" "}
              · <span className="font-medium text-slate-700">TA</span> = teaching
              assistant
            </>
          ) : null}
        </p>
      </div>

      <div className="overflow-x-auto surface-panel">
        <div
          className="min-w-full"
          style={{ minWidth: LABEL_COL_PX + TIMELINE_MIN_WIDTH_PX + 24 }}
        >
          {/* Time ruler */}
          <div
            className="sticky top-0 z-10 grid border-b border-border bg-surface"
            style={{ gridTemplateColumns: `${LABEL_COL_PX}px 1fr` }}
          >
            <div className="border-r border-border bg-bg px-3 py-2 text-xs font-medium text-muted">
              Staff
            </div>
            <div className="relative h-10 px-3">
              {hourTicks.map((m) => {
                const pos = barPosition(m, m, rangeStart, rangeEnd).left;
                return (
                  <span
                    key={m}
                    className="absolute top-2 -translate-x-1/2 text-[11px] font-medium tabular-nums text-muted"
                    style={{ left: pos }}
                  >
                    {minutesLabel(m)}
                  </span>
                );
              })}
            </div>
          </div>

          {/* One row per shift — no overlap */}
          <ul className="divide-y divide-border">
            {blocks.map((b) => {
              const pos = barPosition(
                b.startMin,
                b.endMin,
                rangeStart,
                rangeEnd,
              );
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
                  ? "border-[var(--status-here-border)] bg-[var(--status-here-bg)] text-[var(--status-here-ink)]"
                  : b.status === "done"
                    ? "border-border bg-bg text-ink"
                    : "border-border bg-surface text-ink";

              const statusLabel =
                b.status === "here"
                  ? "Here"
                  : b.status === "done"
                    ? "Done"
                    : null;

              return (
                <li
                  key={b.key}
                  className="grid items-stretch"
                  style={{ gridTemplateColumns: `${LABEL_COL_PX}px 1fr` }}
                >
                  <div className="flex flex-col gap-1.5 border-r border-border bg-bg px-3 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-semibold leading-snug text-ink">
                        {b.name}
                      </p>
                      <RoleBadge role={b.role} />
                      {b.isRecurring ? (
                        <span
                          className="text-[10px] font-medium text-muted"
                          title="Recurring weekly"
                        >
                          ↻
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs tabular-nums text-muted">
                      {formatShiftRange(b.shiftLabel)}
                      {b.timeInLabel ? ` · in ${b.timeInLabel}` : ""}
                    </p>
                    {statusLabel ? (
                      <span className="inline-flex w-fit rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-brand/10 text-brand-ink">
                        {statusLabel}
                      </span>
                    ) : null}
                    {canCheckIn ? (
                      <button
                        type="button"
                        disabled={!!pending}
                        onClick={() => onCheckIn?.(b.tutor!, b.shiftLabel)}
                        className="btn-primary mt-1 min-h-9 w-full px-2 text-xs"
                      >
                        Check in
                      </button>
                    ) : null}
                  </div>

                  <div
                    className="relative min-h-[3.5rem] px-3 py-3"
                    onContextMenu={(e) => {
                      if (!onEditAttendance || !b.attendanceId) return;
                      e.preventDefault();
                      onEditAttendance(b.attendanceId);
                    }}
                  >
                    {hourTicks.map((m) => {
                      const left = barPosition(m, m, rangeStart, rangeEnd).left;
                      return (
                        <div
                          key={`${b.key}-grid-${m}`}
                          className="absolute top-2 bottom-2 border-l border-slate-100"
                          style={{ left }}
                        />
                      );
                    })}

                    <div
                      className={`absolute top-3 bottom-3 flex min-w-[4rem] items-center overflow-hidden rounded-md border px-2 ${tone} ${roleRailClass(b.role, b.status)}`}
                      style={{ left: pos.left, right: pos.right }}
                      title={`${b.name} · ${formatShiftRange(b.shiftLabel)}`}
                    >
                      <p className="truncate text-xs font-medium">
                        {formatShiftRange(b.shiftLabel)}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {blocks.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted">
              No shifts scheduled for this day.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
