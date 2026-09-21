import ExcelJS from "exceljs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canonicalTutorName, normalizeTutorKey } from "@/lib/tutor-aliases";
import { hoursBetween, minutesBetween } from "@/lib/schedule";

const BEIRUT_OFFSET = "+03:00";

export type ImportSummary = {
  tutorsCreated: number;
  attendanceInserted: number;
  attendanceSkipped: number;
  visitsInserted: number;
  visitsSkipped: number;
  warnings: string[];
};

function cellText(value: ExcelJS.CellValue): string {
  if (value == null || value === "") return "";
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const obj = value as {
      text?: string;
      result?: unknown;
      richText?: { text: string }[];
      hyperlink?: string;
    };
    if (typeof obj.text === "string") return obj.text.trim();
    if (Array.isArray(obj.richText)) {
      return obj.richText.map((r) => r.text).join("").trim();
    }
    if (obj.result != null) return cellText(obj.result as ExcelJS.CellValue);
  }
  return String(value).trim();
}

function excelDateToIso(value: ExcelJS.CellValue): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const raw = cellText(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return null;
}

/** Excel wall-clock hours/minutes from a time cell (UTC components of ExcelJS Date). */
function excelClockParts(
  value: ExcelJS.CellValue,
): { hour: number; minute: number } | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { hour: value.getUTCHours(), minute: value.getUTCMinutes() };
  }
  if (typeof value === "number" && value >= 0 && value < 1) {
    const totalMins = Math.round(value * 24 * 60);
    return { hour: Math.floor(totalMins / 60) % 24, minute: totalMins % 60 };
  }
  const raw = cellText(value);
  const m = raw.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2]);
  if (/pm/i.test(raw) && hour < 12) hour += 12;
  if (/am/i.test(raw) && hour === 12) hour = 0;
  return { hour, minute };
}

/**
 * Tutoring is afternoon. Excel often stores 1:00 PM as hour=1.
 * If hour < 7, treat as PM (hour + 12).
 */
export function applyPmHeuristic(hour: number): number {
  if (hour >= 0 && hour < 7) return hour + 12;
  return hour;
}

export function beirutIsoFromDateAndTime(
  dateStr: string,
  timeValue: ExcelJS.CellValue,
): string | null {
  const clock = excelClockParts(timeValue);
  if (!clock) return null;
  const hour = applyPmHeuristic(clock.hour);
  const hh = String(hour).padStart(2, "0");
  const mm = String(clock.minute).padStart(2, "0");
  return `${dateStr}T${hh}:${mm}:00${BEIRUT_OFFSET}`;
}

function parseTotalHours(
  value: ExcelJS.CellValue,
  timeIn: string | null,
  timeOut: string | null,
): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value < 24) {
    return Math.round(value * 100) / 100;
  }
  const raw = cellText(value);
  if (raw) {
    const hrMin = raw.match(/(\d+)\s*hr(?:s)?\s*(\d+)\s*min/i);
    if (hrMin) {
      return Math.round((Number(hrMin[1]) + Number(hrMin[2]) / 60) * 100) / 100;
    }
    const onlyMin = raw.match(/^(\d+)\s*min/i);
    if (onlyMin) return Math.round((Number(onlyMin[1]) / 60) * 100) / 100;
    const onlyHr = raw.match(/^(\d+)\s*hr/i);
    if (onlyHr) return Number(onlyHr[1]);
    const asNum = Number(raw);
    if (Number.isFinite(asNum) && asNum < 24) return asNum;
  }
  if (timeIn && timeOut) return hoursBetween(timeIn, timeOut);
  return null;
}

function parseDurationMinutes(
  value: ExcelJS.CellValue,
  timeIn: string | null,
  timeOut: string | null,
): number | null {
  const raw = cellText(value);
  if (raw) {
    const hrMin = raw.match(/(\d+)\s*hr(?:s)?\s*(\d+)\s*min/i);
    if (hrMin) return Number(hrMin[1]) * 60 + Number(hrMin[2]);
    const onlyMin = raw.match(/(\d+)\s*min/i);
    if (onlyMin) return Number(onlyMin[1]);
    const onlyHr = raw.match(/(\d+)\s*hr/i);
    if (onlyHr) return Number(onlyHr[1]) * 60;
  }
  if (timeIn && timeOut) return minutesBetween(timeIn, timeOut);
  return null;
}

function titleCaseName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) =>
      w.length <= 2 && w.toLowerCase() === w
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join(" ")
    .replace(/\bAl\b/g, "al")
    .replace(/\bEl\b/g, "El");
}

export async function loadTemplateBuffer(
  customPath?: string,
): Promise<Buffer> {
  const filePath =
    customPath ?? path.join(process.cwd(), "src", "data", "attendance-template.xlsx");
  return readFile(/*turbopackIgnore: true*/ filePath);
}

type ParsedTutorRow = {
  date: string;
  name: string;
  scheduledShift: string;
  role: string;
  timeIn: string | null;
  timeOut: string | null;
  totalHours: number | null;
  notes: string;
};

type ParsedVisitRow = {
  date: string;
  studentName: string;
  studentEmail: string;
  timeIn: string | null;
  timeOut: string | null;
  durationMinutes: number | null;
  course: string;
  helperName: string;
  notes: string;
};

export function parseAttendanceWorkbook(wb: ExcelJS.Workbook): {
  tutors: ParsedTutorRow[];
  visits: ParsedVisitRow[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const tutorsSheet = wb.getWorksheet("Tutors");
  const tutoreeSheet = wb.getWorksheet("Tutoree");
  if (!tutorsSheet) throw new Error('Missing "Tutors" sheet');
  if (!tutoreeSheet) throw new Error('Missing "Tutoree" sheet');

  const tutors: ParsedTutorRow[] = [];
  tutorsSheet.eachRow((row, n) => {
    if (n === 1) return;
    const nameRaw = cellText(row.getCell(2).value);
    if (!nameRaw) return;
    const date = excelDateToIso(row.getCell(1).value);
    if (!date) {
      warnings.push(`Tutors row ${n}: skip (bad date)`);
      return;
    }
    const timeIn = beirutIsoFromDateAndTime(date, row.getCell(5).value);
    const timeOut = beirutIsoFromDateAndTime(date, row.getCell(6).value);
    // If out < in after heuristic (crossed noon), leave as-is — heuristic already applied per cell
    let adjustedOut = timeOut;
    if (timeIn && timeOut && timeOut < timeIn) {
      // time_out still AM while time_in became PM — bump out by 12h once more if needed
      const clock = excelClockParts(row.getCell(6).value);
      if (clock && clock.hour < 12) {
        const hh = String(clock.hour + 12).padStart(2, "0");
        const mm = String(clock.minute).padStart(2, "0");
        adjustedOut = `${date}T${hh}:${mm}:00${BEIRUT_OFFSET}`;
      }
    }
    tutors.push({
      date,
      name: canonicalTutorName(nameRaw),
      scheduledShift: cellText(row.getCell(3).value),
      role: cellText(row.getCell(4).value) || "Tutor",
      timeIn,
      timeOut: adjustedOut,
      totalHours: parseTotalHours(row.getCell(7).value, timeIn, adjustedOut),
      notes: cellText(row.getCell(8).value),
    });
  });

  const visits: ParsedVisitRow[] = [];
  tutoreeSheet.eachRow((row, n) => {
    if (n === 1) return;
    const studentName = cellText(row.getCell(2).value);
    if (!studentName) return;
    const date = excelDateToIso(row.getCell(1).value);
    if (!date) {
      warnings.push(`Tutoree row ${n}: skip (bad date)`);
      return;
    }
    const timeIn = beirutIsoFromDateAndTime(date, row.getCell(4).value);
    let timeOut = beirutIsoFromDateAndTime(date, row.getCell(5).value);
    if (timeIn && timeOut && timeOut < timeIn) {
      const clock = excelClockParts(row.getCell(5).value);
      if (clock && clock.hour < 12) {
        const hh = String(clock.hour + 12).padStart(2, "0");
        const mm = String(clock.minute).padStart(2, "0");
        timeOut = `${date}T${hh}:${mm}:00${BEIRUT_OFFSET}`;
      }
    }
    const helperRaw = cellText(row.getCell(8).value);
    visits.push({
      date,
      studentName,
      studentEmail: cellText(row.getCell(3).value),
      timeIn,
      timeOut,
      durationMinutes: parseDurationMinutes(
        row.getCell(6).value,
        timeIn,
        timeOut,
      ),
      course: cellText(row.getCell(7).value),
      helperName: helperRaw ? canonicalTutorName(helperRaw) : "",
      notes: cellText(row.getCell(9).value),
    });
  });

  return { tutors, visits, warnings };
}

async function ensureTutorId(
  supabase: SupabaseClient,
  name: string,
  cache: Map<string, string>,
  created: { count: number },
): Promise<string> {
  const key = normalizeTutorKey(name);
  const hit = cache.get(key);
  if (hit) return hit;

  const { data: existing } = await supabase
    .from("tutors")
    .select("id, name")
    .ilike("name", name)
    .maybeSingle();

  if (existing?.id) {
    cache.set(key, existing.id);
    cache.set(normalizeTutorKey(existing.name), existing.id);
    return existing.id;
  }

  // Fuzzy: scan cache + case-insensitive match against all known
  for (const [k, id] of cache) {
    if (k === key) return id;
  }

  const display = titleCaseName(name);
  const { data: inserted, error } = await supabase
    .from("tutors")
    .insert({ name: display, courses: [], active: true })
    .select("id, name")
    .single();

  if (error) {
    // Race: unique name — re-fetch
    const { data: again } = await supabase
      .from("tutors")
      .select("id, name")
      .ilike("name", display)
      .maybeSingle();
    if (again?.id) {
      cache.set(key, again.id);
      return again.id;
    }
    throw new Error(`Failed to create tutor ${display}: ${error.message}`);
  }

  created.count += 1;
  cache.set(key, inserted.id);
  cache.set(normalizeTutorKey(inserted.name), inserted.id);
  return inserted.id;
}

function normalizeIsoKey(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? iso : String(t);
}

function attendanceDedupKey(
  date: string,
  tutorId: string,
  timeIn: string | null | undefined,
): string {
  return `${date}|${tutorId}|${normalizeIsoKey(timeIn)}`;
}

function visitDedupKey(
  date: string,
  studentName: string,
  timeIn: string | null | undefined,
): string {
  return `${date}|${normalizeTutorKey(studentName)}|${normalizeIsoKey(timeIn)}`;
}

export async function importAttendanceFromBuffer(
  supabase: SupabaseClient,
  buffer: Buffer,
  createdBy = "excel-import",
): Promise<ImportSummary> {
  const wb = new ExcelJS.Workbook();
  // exceljs typings accept Buffer via ArrayBuffer-like
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const parsed = parseAttendanceWorkbook(wb);

  const summary: ImportSummary = {
    tutorsCreated: 0,
    attendanceInserted: 0,
    attendanceSkipped: 0,
    visitsInserted: 0,
    visitsSkipped: 0,
    warnings: [...parsed.warnings],
  };

  const { data: allTutors, error: tutorsErr } = await supabase
    .from("tutors")
    .select("id, name");
  if (tutorsErr) throw new Error(tutorsErr.message);

  const tutorCache = new Map<string, string>();
  for (const t of allTutors ?? []) {
    tutorCache.set(normalizeTutorKey(t.name), t.id);
  }

  const dates = Array.from(
    new Set([
      ...parsed.tutors.map((r) => r.date),
      ...parsed.visits.map((r) => r.date),
    ]),
  ).sort();

  const existingAttKeys = new Set<string>();
  if (dates.length > 0) {
    const { data: existingAtt } = await supabase
      .from("tutor_attendance")
      .select("attendance_date, tutor_id, time_in")
      .gte("attendance_date", dates[0])
      .lte("attendance_date", dates[dates.length - 1]);
    for (const row of existingAtt ?? []) {
      existingAttKeys.add(
        attendanceDedupKey(
          row.attendance_date,
          row.tutor_id,
          row.time_in,
        ),
      );
    }
  }

  const existingVisitKeys = new Set<string>();
  if (dates.length > 0) {
    const { data: existingVis } = await supabase
      .from("student_visits")
      .select("visit_date, student_name, time_in")
      .gte("visit_date", dates[0])
      .lte("visit_date", dates[dates.length - 1]);
    for (const row of existingVis ?? []) {
      existingVisitKeys.add(
        visitDedupKey(row.visit_date, row.student_name, row.time_in),
      );
    }
  }

  const created = { count: 0 };

  for (const row of parsed.tutors) {
    if (!row.timeIn) {
      summary.warnings.push(
        `Skip attendance ${row.date} ${row.name}: missing time in`,
      );
      summary.attendanceSkipped += 1;
      continue;
    }
    const tutorId = await ensureTutorId(
      supabase,
      row.name,
      tutorCache,
      created,
    );
    const key = attendanceDedupKey(row.date, tutorId, row.timeIn);
    if (existingAttKeys.has(key)) {
      summary.attendanceSkipped += 1;
      continue;
    }
    const { error } = await supabase.from("tutor_attendance").insert({
      attendance_date: row.date,
      tutor_id: tutorId,
      scheduled_shift: row.scheduledShift,
      role: row.role.replace(/\s+$/, "") || "Tutor",
      time_in: row.timeIn,
      time_out: row.timeOut,
      total_hours: row.totalHours,
      notes: row.notes,
      created_by: createdBy,
    });
    if (error) {
      summary.warnings.push(
        `Attendance insert failed ${row.date} ${row.name}: ${error.message}`,
      );
      continue;
    }
    existingAttKeys.add(key);
    summary.attendanceInserted += 1;
  }

  for (const row of parsed.visits) {
    let tutorId: string | null = null;
    if (row.helperName) {
      tutorId = await ensureTutorId(
        supabase,
        row.helperName,
        tutorCache,
        created,
      );
    }
    // Placeholder time_in when missing so row still appears on desk
    const timeIn =
      row.timeIn ?? `${row.date}T13:00:00${BEIRUT_OFFSET}`;
    const visitKey = visitDedupKey(row.date, row.studentName, timeIn);
    if (existingVisitKeys.has(visitKey)) {
      summary.visitsSkipped += 1;
      continue;
    }
    const { error } = await supabase.from("student_visits").insert({
      visit_date: row.date,
      student_name: row.studentName,
      student_email: row.studentEmail,
      time_in: timeIn,
      time_out: row.timeOut,
      duration_minutes: row.durationMinutes,
      course: row.course,
      tutor_id: tutorId,
      notes: row.notes,
      created_by: createdBy,
    });
    if (error) {
      summary.warnings.push(
        `Visit insert failed ${row.date} ${row.studentName}: ${error.message}`,
      );
      continue;
    }
    existingVisitKeys.add(visitKey);
    summary.visitsInserted += 1;
  }

  summary.tutorsCreated = created.count;
  return summary;
}

export async function importAttendanceFromTemplate(
  supabase: SupabaseClient,
  createdBy = "excel-import",
): Promise<ImportSummary> {
  const buffer = await loadTemplateBuffer();
  return importAttendanceFromBuffer(supabase, buffer, createdBy);
}
