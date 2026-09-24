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
import { CourseList } from "./course-list";
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

const LABEL_COL_PX = 176;
const TIMELINE_MIN_WIDTH_PX = 640;

function minutesPad(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
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

function useCalendarBlocks(
  shifts: MergedShift[],
  attendance: TutorAttendanceRow[],
  nameToTutor: Map<string, TutorRow>,
  checkedInIds: Set<string>,
  rangeStart: number,
  rangeEnd: number,
) {
  return useMemo(() => {
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
}

function ScheduleFilters({
  filter,
  onFilter,
}: {
  filter: Filter;
  onFilter: (f: Filter) => void;
}) {
  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "ta", label: "TAs" },
    { id: "upcoming", label: "Upcoming" },
    { id: "done", label: "Done" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => onFilter(f.id)}
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
  );
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
            <p className="break-words text-base font-semibold text-ink">{b.name}</p>
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
          <CourseList courses={b.courses} className="mt-1" />
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

function ScheduleAgenda({
  blocks,
  filtered,
  filter,
  isToday,
  readOnly,
  isPending,
  checkedInIds,
  onCheckIn,
  onEditAttendance,
  completedOpen,
  onCompletedOpen,
}: {
  blocks: CalendarBlock[];
  filtered: CalendarBlock[];
  filter: Filter;
  isToday: boolean;
  readOnly: boolean;
  isPending: (key: string) => boolean;
  checkedInIds: Set<string>;
  onCheckIn?: (tutor: TutorRow, scheduledShift: string) => void;
  onEditAttendance?: (attendanceId: string) => void;
  completedOpen: boolean;
  onCompletedOpen: (open: boolean) => void;
}) {
  const activeBlocks = filtered.filter((b) => b.status !== "done");
  const doneBlocks = filtered.filter((b) => b.status === "done");
  const mainBlocks = filter === "done" ? doneBlocks : activeBlocks;
  const collapsibleDone =
    filter === "all" || filter === "ta" ? doneBlocks : [];
  const hourGroups = groupByHour(mainBlocks);
  const sortedHours = [...hourGroups.keys()].sort((a, b) => a - b);

  if (blocks.length === 0) {
    return (
      <div className="surface-panel border-dashed px-5 py-5 text-center">
        <p className="text-sm font-medium text-ink">No shifts scheduled</p>
        <p className="mt-1 text-sm text-muted">
          Nothing on the roster for this day.
        </p>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="surface-panel border-dashed px-5 py-5 text-center">
        <p className="text-sm font-medium text-ink">No shifts match this filter</p>
      </div>
    );
  }

  return (
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
            onClick={() => onCompletedOpen(!completedOpen)}
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
  );
}

function ScheduleTimeline({
  blocks,
  filtered,
  rangeStart,
  rangeEnd,
  isToday,
  readOnly,
  isPending,
  checkedInIds,
  onCheckIn,
  onEditAttendance,
}: {
  blocks: CalendarBlock[];
  filtered: CalendarBlock[];
  rangeStart: number;
  rangeEnd: number;
  isToday: boolean;
  readOnly: boolean;
  isPending: (key: string) => boolean;
  checkedInIds: Set<string>;
  onCheckIn?: (tutor: TutorRow, scheduledShift: string) => void;
  onEditAttendance?: (attendanceId: string) => void;
}) {
  const hourTicks = useMemo(() => {
    const out: number[] = [];
    for (let m = rangeStart; m <= rangeEnd; m += 60) out.push(m);
    return out;
  }, [rangeStart, rangeEnd]);

  if (blocks.length === 0) {
    return (
      <div className="surface-panel border-dashed px-5 py-5 text-center">
        <p className="text-sm font-medium text-ink">No shifts scheduled</p>
        <p className="mt-1 text-sm text-muted">
          Nothing on the roster for this day.
        </p>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="surface-panel border-dashed px-5 py-5 text-center">
        <p className="text-sm font-medium text-ink">No shifts match this filter</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto surface-panel">
      <div
        className="min-w-full"
        style={{ minWidth: LABEL_COL_PX + TIMELINE_MIN_WIDTH_PX + 24 }}
      >
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

        <ul className="divide-y divide-border">
          {filtered.map((b) => {
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
                    className={`absolute top-3 bottom-3 flex min-w-[4rem] items-center overflow-hidden rounded-md border px-2 ${tone} ${cardRailClass(b.role, b.status)}`}
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
      </div>
    </div>
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

  const blocks = useCalendarBlocks(
    shifts,
    attendance,
    nameToTutor,
    checkedInIds,
    rangeStart,
    rangeEnd,
  );

  const filtered = useMemo(() => {
    if (filter === "all") return blocks;
    if (filter === "ta") return blocks.filter((b) => b.role === "TA");
    if (filter === "done") return blocks.filter((b) => b.status === "done");
    return blocks.filter((b) => b.status === "scheduled");
  }, [blocks, filter]);

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
          {blocks.length} shift{blocks.length === 1 ? "" : "s"}
          <span className="hidden lg:inline"> · timeline view</span>
          <span className="lg:hidden"> · sorted by time</span>
          {hasTa ? (
            <>
              {" "}
              · <span className="font-medium text-slate-700">TA</span> = teaching
              assistant
            </>
          ) : null}
        </p>
      </div>

      <ScheduleFilters filter={filter} onFilter={setFilter} />

      <div className="lg:hidden">
        <ScheduleAgenda
          blocks={blocks}
          filtered={filtered}
          filter={filter}
          isToday={isToday}
          readOnly={readOnly}
          isPending={isPending}
          checkedInIds={checkedInIds}
          onCheckIn={onCheckIn}
          onEditAttendance={onEditAttendance}
          completedOpen={completedOpen}
          onCompletedOpen={setCompletedOpen}
        />
      </div>

      <div className="hidden lg:block">
        <ScheduleTimeline
          blocks={blocks}
          filtered={filtered}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          isToday={isToday}
          readOnly={readOnly}
          isPending={isPending}
          checkedInIds={checkedInIds}
          onCheckIn={onCheckIn}
          onEditAttendance={onEditAttendance}
        />
      </div>
    </section>
  );
}
