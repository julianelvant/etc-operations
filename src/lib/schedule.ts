import scheduleData from "@/data/schedule.json";

export type ScheduledTutor = {
  name: string;
  courses: string[];
};

export type Schedule = {
  title: string;
  timezone: string;
  days: Record<string, Record<string, ScheduledTutor[]>>;
};

export const schedule = scheduleData as Schedule;
export const TIMEZONE = schedule.timezone || "Asia/Beirut";

const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export function getBeirutParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value]),
  );
  const weekday = (parts.weekday || "").toLowerCase();
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday,
    time: `${hour}:${parts.minute}`,
    dayKey: weekday as (typeof DAY_KEYS)[number],
  };
}

export function getTodaySchedule() {
  const { date, dayKey, time } = getBeirutParts();
  const daySlots = schedule.days[dayKey] ?? {};
  return { date, dayKey, time, slots: daySlots };
}

/** Parse YYYY-MM-DD as a Beirut calendar day and return schedule slots. */
export function getScheduleForDate(dateStr: string) {
  const parts = getBeirutParts(new Date(`${dateStr}T12:00:00+03:00`));
  // Prefer weekday from the date string itself for stability
  const [y, m, d] = dateStr.split("-").map(Number);
  const utcGuess = new Date(Date.UTC(y, m - 1, d, 9, 0, 0));
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "long",
  })
    .format(utcGuess)
    .toLowerCase();
  const dayKey = weekday as (typeof DAY_KEYS)[number];
  return {
    date: dateStr,
    dayKey,
    time: parts.date === dateStr ? parts.time : "12:00",
    slots: schedule.days[dayKey] ?? {},
    isToday: parts.date === dateStr,
  };
}

export function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

export function startOfWeekMonday(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
  }).format(utc);
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  const offset = map[weekday] ?? 0;
  return addDays(dateStr, -offset);
}

export function getWeekDates(dateStr: string) {
  const start = startOfWeekMonday(dateStr);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    const info = getScheduleForDate(date);
    return {
      date,
      dayKey: info.dayKey,
      label: new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        timeZone: "UTC",
      }).format(new Date(`${date}T12:00:00Z`)),
      dayNum: Number(date.slice(8, 10)),
      tutorCount: new Set(
        Object.values(info.slots).flatMap((list) =>
          list.map((t) => t.name.toLowerCase()),
        ),
      ).size,
    };
  });
}

/** Minutes from midnight in Beirut for an ISO timestamp. */
export function beirutMinutes(iso: string): number {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  );
  let h = Number(parts.hour === "24" ? "0" : parts.hour);
  const min = Number(parts.minute);
  return h * 60 + min;
}

export function clockToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export const TIMELINE_START_MIN = 12 * 60; // 12:00
export const TIMELINE_END_MIN = 18 * 60; // 18:00
export const TIMELINE_PX_PER_MIN = 1.35;

export type MergedShift = {
  name: string;
  courses: string[];
  start: number;
  end: number;
  /** Machine range e.g. "15:00-17:00" for attendance.scheduled_shift */
  shiftLabel: string;
};

function minutesToClock(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Merge contiguous hourly slots into one row per tutor shift for a day. */
export function getMergedShiftsForDay(
  slots: Record<string, ScheduledTutor[]>,
): MergedShift[] {
  type Interval = { start: number; end: number; courses: string[] };
  const byTutor = new Map<string, { name: string; intervals: Interval[] }>();

  for (const slot of Object.keys(slots).sort()) {
    const [a, b] = slot.split("-");
    const start = clockToMinutes(a);
    const end = clockToMinutes(b);
    for (const entry of slots[slot]) {
      const key = entry.name.toLowerCase();
      let row = byTutor.get(key);
      if (!row) {
        row = { name: entry.name, intervals: [] };
        byTutor.set(key, row);
      }
      row.intervals.push({
        start,
        end,
        courses: [...entry.courses],
      });
    }
  }

  const merged: MergedShift[] = [];
  for (const row of byTutor.values()) {
    const sorted = [...row.intervals].sort((x, y) => x.start - y.start);
    let cur = sorted[0];
    if (!cur) continue;
    const courses = new Set(cur.courses);

    const flush = () => {
      const startClock = minutesToClock(cur.start);
      const endClock = minutesToClock(cur.end);
      merged.push({
        name: row.name,
        courses: Array.from(courses).sort(),
        start: cur.start,
        end: cur.end,
        shiftLabel: `${startClock}-${endClock}`,
      });
    };

    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i];
      if (next.start <= cur.end) {
        cur = { ...cur, end: Math.max(cur.end, next.end) };
        for (const c of next.courses) courses.add(c);
      } else {
        flush();
        cur = next;
        courses.clear();
        for (const c of next.courses) courses.add(c);
      }
    }
    flush();
  }

  return merged.sort(
    (a, b) => a.start - b.start || a.name.localeCompare(b.name),
  );
}

/** Infer contiguous scheduled shift for a tutor on a given weekday, e.g. "13:00-15:00" */
export function getScheduledShiftForTutor(
  tutorName: string,
  dayKey: string,
): string {
  const day = schedule.days[dayKey];
  if (!day) return "";
  const shifts = getMergedShiftsForDay(day).filter(
    (s) => s.name.toLowerCase() === tutorName.toLowerCase(),
  );
  if (shifts.length === 0) return "";
  if (shifts.length === 1) return shifts[0].shiftLabel;
  return shifts.map((s) => s.shiftLabel).join(", ");
}

export function getTutorsForDay(dayKey: string): ScheduledTutor[] {
  const day = schedule.days[dayKey];
  if (!day) return [];
  const map = new Map<string, ScheduledTutor>();
  for (const tutors of Object.values(day)) {
    for (const t of tutors) {
      const existing = map.get(t.name.toLowerCase());
      if (existing) {
        const courses = new Set([...existing.courses, ...t.courses]);
        existing.courses = Array.from(courses).sort();
      } else {
        map.set(t.name.toLowerCase(), {
          name: t.name,
          courses: [...t.courses],
        });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export function formatClock(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function formatDurationMinutes(mins: number | null | undefined): string {
  if (mins == null || Number.isNaN(mins)) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

export function hoursBetween(timeIn: string, timeOut: string): number {
  const ms = new Date(timeOut).getTime() - new Date(timeIn).getTime();
  return Math.round((ms / 3_600_000) * 100) / 100;
}

export function minutesBetween(timeIn: string, timeOut: string): number {
  const ms = new Date(timeOut).getTime() - new Date(timeIn).getTime();
  return Math.max(0, Math.round(ms / 60_000));
}

export function slotLabel(slot: string): string {
  // "13:00-14:00" -> "1:00 - 2:00 PM"
  const [start, end] = slot.split("-");
  const to12 = (t: string) => {
    const [hStr, m] = t.split(":");
    let h = Number(hStr);
    const suffix = h >= 12 ? "PM" : "AM";
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${h}:${m} ${suffix}`;
  };
  return `${to12(start).replace(/ (AM|PM)$/, "")} - ${to12(end)}`;
}
