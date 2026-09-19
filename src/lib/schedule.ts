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

/** Infer contiguous scheduled shift for a tutor on a given weekday, e.g. "13:00-15:00" */
export function getScheduledShiftForTutor(
  tutorName: string,
  dayKey: string,
): string {
  const day = schedule.days[dayKey];
  if (!day) return "";

  const slots = Object.keys(day).sort();
  const matching: string[] = [];
  for (const slot of slots) {
    if (day[slot].some((t) => t.name.toLowerCase() === tutorName.toLowerCase())) {
      matching.push(slot);
    }
  }
  if (matching.length === 0) return "";
  if (matching.length === 1) return matching[0];

  // Merge contiguous slots
  const starts = matching.map((s) => s.split("-")[0]);
  const ends = matching.map((s) => s.split("-")[1]);
  return `${starts[0]}-${ends[ends.length - 1]}`;
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
