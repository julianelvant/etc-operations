/**
 * Parse / normalize tutoring shift strings from Excel and the weekly schedule.
 * Canonical form: "HH:MM-HH:MM" in 24h (Asia/Beirut tutoring afternoon).
 */

/** Tutoring is afternoon. Excel often stores 1:00 PM as hour=1. */
export function applyPmHeuristic(hour: number): number {
  if (hour >= 0 && hour < 7) return hour + 12;
  return hour;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function minutesToClock(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

export function clockToMinutes(hhmm: string): number {
  const cleaned = hhmm.trim().replace(/\s+/g, "");
  const m = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

type ClockParts = { hour: number; minute: number; hadMeridiem: boolean };

/**
 * Parse a single clock token from Excel mess:
 * "1:20", "3:30", "1:00 pm", "3:00:00 PM", "1: 00 pm", "2:00pm"
 */
export function parseClockToken(raw: string): ClockParts | null {
  const s = raw.trim().replace(/\s+/g, " ");
  if (!s) return null;

  const meridiem = s.match(/\b(am|pm)\b/i)?.[1]?.toLowerCase();
  const hadMeridiem = Boolean(meridiem);

  const m = s.match(/(\d{1,2})\s*:\s*(\d{2})(?:\s*:\s*\d{2})?/);
  if (!m) return null;

  let hour = Number(m[1]);
  const minute = Number(m[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (minute < 0 || minute > 59 || hour < 0 || hour > 23) return null;

  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;

  return { hour, minute, hadMeridiem };
}

function to24hMinutes(parts: ClockParts, forcePmHeuristic: boolean): number {
  let hour = parts.hour;
  if (!parts.hadMeridiem && forcePmHeuristic) {
    hour = applyPmHeuristic(hour);
  }
  return hour * 60 + parts.minute;
}

export type ParsedShift = {
  /** Canonical "HH:MM-HH:MM" 24h */
  canonical: string;
  startMin: number;
  endMin: number;
};

/**
 * Normalize Excel / free-text scheduled shift to canonical 24h range.
 * Returns null when unparseable.
 */
export function normalizeScheduledShift(
  raw: string | null | undefined,
): ParsedShift | null {
  if (!raw) return null;
  let text = String(raw).trim();
  if (!text) return null;

  // Already canonical 24h
  const canon = text.match(/^(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})$/);
  if (canon) {
    const startMin = Number(canon[1]) * 60 + Number(canon[2]);
    const endMin = Number(canon[3]) * 60 + Number(canon[4]);
    if (endMin > startMin) {
      return {
        canonical: `${canon[1]}:${canon[2]}-${canon[3]}:${canon[4]}`,
        startMin,
        endMin,
      };
    }
  }

  // Normalize weird dashes / spacing
  text = text
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim();

  // Split on " - " or bare "-" between times
  const parts = text.split(/\s+-\s+/);
  if (parts.length < 2) {
    // Try "1:20-3:20" without spaces (already handled by split if we also try)
    const dash = text.match(
      /^(.+?)[-–—](.+)$/,
    );
    if (!dash) return null;
    parts.length = 0;
    parts.push(dash[1], dash[2]);
  }

  const startTok = parseClockToken(parts[0]);
  const endTok = parseClockToken(parts[1]);
  if (!startTok || !endTok) return null;

  // If either side has meridiem, use it; otherwise apply PM heuristic for tutoring
  const forcePm = !startTok.hadMeridiem && !endTok.hadMeridiem;
  let startMin = to24hMinutes(startTok, forcePm || !startTok.hadMeridiem);
  let endMin = to24hMinutes(endTok, forcePm || !endTok.hadMeridiem);

  // If end still before start (e.g. start got +12, end didn't), bump end
  if (endMin <= startMin && endMin < 12 * 60) {
    endMin += 12 * 60;
  }
  if (endMin <= startMin) return null;

  return {
    canonical: `${minutesToClock(startMin)}-${minutesToClock(endMin)}`,
    startMin,
    endMin,
  };
}

/** Display label: "13:00-15:00" or messy Excel → "1:00 - 3:00 PM" */
export function formatShiftRange(slot: string | null | undefined): string {
  if (!slot) return "";
  const parsed = normalizeScheduledShift(slot);
  if (!parsed) {
    // Fallback: try simple split without lying about AM
    return slot.trim();
  }
  const to12 = (mins: number) => {
    let h = Math.floor(mins / 60);
    const m = mins % 60;
    const suffix = h >= 12 ? "PM" : "AM";
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return { label: `${h}:${pad2(m)}`, suffix };
  };
  const a = to12(parsed.startMin);
  const b = to12(parsed.endMin);
  if (a.suffix === b.suffix) {
    return `${a.label} - ${b.label} ${b.suffix}`;
  }
  return `${a.label} ${a.suffix} - ${b.label} ${b.suffix}`;
}

export function shiftToMinutes(
  slot: string | null | undefined,
): { startMin: number; endMin: number } | null {
  const p = normalizeScheduledShift(slot);
  if (!p) return null;
  return { startMin: p.startMin, endMin: p.endMin };
}
