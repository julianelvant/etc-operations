"use client";

import { useMemo } from "react";
import type { TutorAttendanceRow, TutorRow } from "@/lib/attendance";
import {
  TIMELINE_END_MIN,
  TIMELINE_PX_PER_MIN,
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
  row: number;
  rowCount: number;
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
  /** Admin / read-only: hide check-in controls */
  readOnly?: boolean;
  onEditAttendance?: (attendanceId: string) => void;
};

const ROW_HEIGHT_PX = 80;
const TIME_RULER_HEIGHT_PX = 40;
const TIMELINE_MIN_WIDTH_PX = 720;

function assignRows(
  blocks: Omit<CalendarBlock, "row" | "rowCount">[],
): CalendarBlock[] {
  const sorted = [...blocks].sort(
    (a, b) =>
      a.startMin - b.startMin ||
      a.endMin - b.endMin ||
      a.name.localeCompare(b.name),
  );
  const rowEnds: number[] = [];
  const withRow: CalendarBlock[] = [];

  for (const b of sorted) {
    let row = rowEnds.findIndex((end) => end <= b.startMin);
    if (row === -1) {
      row = rowEnds.length;
      rowEnds.push(b.endMin);
    } else {
      rowEnds[row] = b.endMin;
    }
    withRow.push({ ...b, row, rowCount: 1 });
  }

  const maxRow = Math.max(0, ...withRow.map((b) => b.row)) + 1;
  return withRow.map((b) => ({ ...b, rowCount: maxRow }));
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

function roleRailClass(role: ShiftRole, status: CalendarBlock["status"]): string {
  if (status === "here") return "border-l-[3px] border-l-[var(--status-here-border)]";
  if (role === "TA") return "border-l-[3px] border-l-slate-600";
  if (role === "Coordinator") return "border-l-[3px] border-l-brand";
  return "border-l-[3px] border-l-transparent";
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
  const totalMin = rangeEnd - rangeStart;
  const timelineWidthPx = totalMin * TIMELINE_PX_PER_MIN;

  const blocks = useMemo(() => {
    const byKey = new Map<string, Omit<CalendarBlock, "row" | "rowCount">>();

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

    return assignRows(
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

  const rowCount = Math.max(1, ...blocks.map((b) => b.rowCount));
  const gridHeightPx = rowCount * ROW_HEIGHT_PX;
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
          {blocks.length} block{blocks.length === 1 ? "" : "s"} · time runs
          left to right
          {hasTa ? (
            <>
              {" "}
              · <span className="font-medium text-slate-700">TA</span> badge =
              teaching assistant
            </>
          ) : null}
        </p>
      </div>

      <div className="overflow-x-auto surface-panel">
        <div
          className="relative min-w-full"
          style={{ minWidth: TIMELINE_MIN_WIDTH_PX + 48 }}
        >
          {/* Sticky time ruler */}
          <div
            className="sticky top-0 z-20 border-b border-border bg-surface"
            style={{ height: TIME_RULER_HEIGHT_PX }}
          >
            <div
              className="relative ml-3 mr-3"
              style={{ width: timelineWidthPx, height: TIME_RULER_HEIGHT_PX }}
            >
              {ticks.map((m) => (
                <div
                  key={m}
                  className="absolute top-0 flex h-full flex-col items-center"
                  style={{
                    left: (m - rangeStart) * TIMELINE_PX_PER_MIN,
                  }}
                >
                  <span
                    className={`mt-1 text-[11px] font-medium tabular-nums ${
                      m % 60 === 0 ? "text-ink" : "text-muted"
                    }`}
                  >
                    {minutesLabel(m)}
                  </span>
                  <div
                    className={`mt-auto h-2 w-px ${
                      m % 60 === 0 ? "bg-border" : "bg-slate-200"
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Row stack */}
          <div
            className="relative ml-3 mr-3 overflow-y-auto"
            style={{ height: gridHeightPx }}
          >
            {/* Vertical grid lines */}
            {ticks.map((m) => (
              <div
                key={`grid-${m}`}
                className={`absolute top-0 bottom-0 border-l ${
                  m % 60 === 0 ? "border-border/80" : "border-slate-100"
                }`}
                style={{ left: (m - rangeStart) * TIMELINE_PX_PER_MIN }}
              />
            ))}

            {blocks.map((b) => {
              const leftPx =
                (Math.max(b.startMin, rangeStart) - rangeStart) *
                TIMELINE_PX_PER_MIN;
              const endMin = Math.min(b.endMin, rangeEnd);
              const widthPx = Math.max(
                120,
                (endMin - Math.max(b.startMin, rangeStart)) *
                  TIMELINE_PX_PER_MIN -
                  4,
              );
              const topPx = b.row * ROW_HEIGHT_PX + 8;
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
                <div
                  key={b.key}
                  className="absolute"
                  style={{
                    top: topPx,
                    left: 0,
                    width: timelineWidthPx,
                    height: ROW_HEIGHT_PX - 12,
                  }}
                >
                  <div
                    className={`absolute overflow-hidden rounded-lg border px-3 py-2 ${tone} ${roleRailClass(b.role, b.status)}`}
                    style={{ left: leftPx, width: widthPx, height: "100%" }}
                    title={`${b.name} · ${formatShiftRange(b.shiftLabel)}${b.role !== "Tutor" ? ` · ${b.role}` : ""}`}
                    onContextMenu={(e) => {
                      if (!onEditAttendance || !b.attendanceId) return;
                      e.preventDefault();
                      onEditAttendance(b.attendanceId);
                    }}
                  >
                    <div className="flex h-full min-h-0 flex-col gap-0.5">
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <p className="min-w-0 text-sm font-semibold leading-snug break-words">
                            {b.name}
                          </p>
                          <RoleBadge role={b.role} />
                          {b.isRecurring ? (
                            <span
                              className="shrink-0 text-[10px] font-medium text-muted"
                              title="Recurring weekly entry"
                            >
                              ↻
                            </span>
                          ) : null}
                        </div>
                        {statusLabel ? (
                          <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-brand/10 text-brand-ink">
                            {statusLabel}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs tabular-nums leading-snug text-muted">
                        {formatShiftRange(b.shiftLabel)}
                        {b.timeInLabel ? ` · in ${b.timeInLabel}` : ""}
                      </p>
                      {b.courses.length > 0 && widthPx > 180 ? (
                        <p className="line-clamp-1 text-[11px] leading-snug text-muted">
                          {b.courses.slice(0, 4).join(" · ")}
                          {b.courses.length > 4
                            ? ` +${b.courses.length - 4}`
                            : ""}
                        </p>
                      ) : null}
                      {canCheckIn ? (
                        <button
                          type="button"
                          disabled={!!pending}
                          onClick={() => onCheckIn?.(b.tutor!, b.shiftLabel)}
                          className="btn-primary mt-auto min-h-8 shrink-0 px-2 text-xs"
                        >
                          Check in
                        </button>
                      ) : null}
                    </div>
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
