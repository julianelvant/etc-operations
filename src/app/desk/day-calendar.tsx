"use client";

import { useMemo, useState } from "react";
import type { TutorAttendanceRow, TutorRow } from "@/lib/attendance";
import {
  TIMELINE_END_MIN,
  TIMELINE_START_MIN,
  beirutMinutes,
  type MergedShift,
  type ShiftRole,
} from "@/lib/schedule";
import { formatShiftRange, shiftToMinutes } from "@/lib/shift-time";
import { cardRailClass, RoleBadge } from "./role-badge";
import { StatusPill } from "./status-pill";

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

type Filter = "all" | "ta" | "upcoming" | "done";

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
  if (isToday) return "Today's schedule";
  const label = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Beirut",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T12:00:00+03:00`));
  return `Schedule for ${label}`;
}

function hourHeaderLabel(startMin: number): string {
  let h = Math.floor(startMin / 60);
  const m = startMin % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  if (m === 0) return `${h}:00 ${suffix}`;
  return `${h}:${String(m).padStart(2, "0")} ${suffix}`;
}

function groupByHour(blocks: CalendarBlock[]): Map<number, CalendarBlock[]> {
  const groups = new Map<number, CalendarBlock[]>();
  for (const b of blocks) {
    const hour = Math.floor(b.startMin / 60) * 60;
    const list = groups.get(hour) ?? [];
    list.push(b);
    groups.set(hour, list);
  }
  return groups;
}

function AgendaCard({
  block: b,
  isToday,
  readOnly,
  isPending,
  checkedInIds,
  onCheckIn,
  onEditAttendance,
}: {
  block: CalendarBlock;
  isToday: boolean;
  readOnly: boolean;
  isPending: (key: string) => boolean;
  checkedInIds: Set<string>;
  onCheckIn?: (tutor: TutorRow, scheduledShift: string) => void;
  onEditAttendance?: (attendanceId: string) => void;
}) {
  const pending = b.tutor && isPending(`in:${b.tutor.id}`);
  const canCheckIn =
    !readOnly &&
    isToday &&
    Boolean(onCheckIn) &&
    b.tutor &&
    b.status === "scheduled" &&
    !checkedInIds.has(b.tutor.id);

  const surface =
    b.status === "here"
      ? "bg-[var(--status-here-bg)]"
      : b.status === "done"
        ? "bg-bg"
        : "bg-surface";

  return (
    <li
      className={`${surface} ${cardRailClass(b.role, b.status)}`}
      onContextMenu={(e) => {
        if (!onEditAttendance || !b.attendanceId) return;
        e.preventDefault();
        onEditAttendance(b.attendanceId);
      }}
    >
      <div className="flex items-start justify-between gap-3 px-4 py-3.5">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-ink">{b.name}</p>
            <RoleBadge role={b.role} />
            {b.isRecurring ? (
              <span
                className="text-[11px] font-medium text-muted"
                title="Recurring weekly"
              >
                ↻ Recurring
              </span>
            ) : null}
            {b.status === "here" ? <StatusPill status="here" /> : null}
            {b.status === "done" ? <StatusPill status="done" /> : null}
          </div>
          <p className="text-sm tabular-nums text-muted">
            {formatShiftRange(b.shiftLabel)}
            {b.timeInLabel ? ` · in ${b.timeInLabel}` : ""}
          </p>
          {b.courses.length > 0 ? (
            <p className="text-xs leading-relaxed text-muted">
              {b.courses.slice(0, 4).join(" · ")}
              {b.courses.length > 4 ? ` +${b.courses.length - 4}` : ""}
            </p>
          ) : null}
        </div>
        {canCheckIn ? (
          <button
            type="button"
            disabled={!!pending}
            onClick={() => onCheckIn?.(b.tutor!, b.shiftLabel)}
            className="btn-primary min-w-[5.5rem] shrink-0 px-4"
          >
            Check in
          </button>
        ) : null}
      </div>
    </li>
  );
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
  const [filter, setFilter] = useState<Filter>("all");
  const [completedOpen, setCompletedOpen] = useState(!isToday);

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

  const filtered = useMemo(() => {
    if (filter === "all") return blocks;
    if (filter === "ta") return blocks.filter((b) => b.role === "TA");
    if (filter === "done") return blocks.filter((b) => b.status === "done");
    return blocks.filter((b) => b.status === "scheduled");
  }, [blocks, filter]);

  const activeBlocks = filtered.filter((b) => b.status !== "done");
  const doneBlocks = filtered.filter((b) => b.status === "done");
  const mainBlocks = filter === "done" ? doneBlocks : activeBlocks;
  const collapsibleDone =
    filter === "all" || filter === "ta" ? doneBlocks : [];
  const hourGroups = groupByHour(mainBlocks);
  const sortedHours = [...hourGroups.keys()].sort((a, b) => a - b);

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "ta", label: "TAs" },
    { id: "upcoming", label: "Upcoming" },
    { id: "done", label: "Done" },
  ];

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
          {blocks.length} shift{blocks.length === 1 ? "" : "s"} · sorted by
          time
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`min-h-9 rounded-lg px-3 text-sm font-semibold focus-ring ${
              filter === f.id
                ? "bg-brand text-white"
                : "border border-border bg-surface text-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="surface-panel border-dashed px-5 py-8 text-center">
          <p className="text-sm font-medium text-ink">No shifts match this filter</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedHours.map((hour) => {
            const groupId = `hour-${hour}`;
            const items = hourGroups.get(hour) ?? [];
            return (
              <section key={hour} role="group" aria-labelledby={groupId}>
                <h3
                  id={groupId}
                  className="sticky top-0 z-[1] -mx-1 mb-2 border-b border-border bg-bg/95 px-1 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted backdrop-blur-sm"
                >
                  {hourHeaderLabel(hour)}
                </h3>
                <ul className="divide-y divide-border overflow-hidden surface-panel">
                  {items.map((b) => (
                    <AgendaCard
                      key={b.key}
                      block={b}
                      isToday={isToday}
                      readOnly={readOnly}
                      isPending={isPending}
                      checkedInIds={checkedInIds}
                      onCheckIn={onCheckIn}
                      onEditAttendance={onEditAttendance}
                    />
                  ))}
                </ul>
              </section>
            );
          })}

          {collapsibleDone.length > 0 ? (
            <section aria-labelledby="completed-heading">
              <button
                id="completed-heading"
                type="button"
                onClick={() => setCompletedOpen((o) => !o)}
                className="flex w-full items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 text-left text-sm font-semibold text-ink focus-ring"
              >
                <span>
                  Completed · {collapsibleDone.length} shift
                  {collapsibleDone.length === 1 ? "" : "s"}
                </span>
                <span className="text-muted" aria-hidden="true">
                  {completedOpen ? "▴" : "▾"}
                </span>
              </button>
              {completedOpen ? (
                <ul className="mt-2 divide-y divide-border overflow-hidden surface-panel">
                  {collapsibleDone.map((b) => (
                    <AgendaCard
                      key={b.key}
                      block={b}
                      isToday={isToday}
                      readOnly={readOnly}
                      isPending={isPending}
                      checkedInIds={checkedInIds}
                      onCheckIn={onCheckIn}
                      onEditAttendance={onEditAttendance}
                    />
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}
        </div>
      )}

      {blocks.length === 0 ? (
        <div className="surface-panel border-dashed px-5 py-8 text-center">
          <p className="text-sm font-medium text-ink">No shifts scheduled</p>
          <p className="mt-1 text-sm text-muted">
            Nothing on the roster for this day.
          </p>
        </div>
      ) : null}
    </section>
  );
}
