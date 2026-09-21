import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
import { createClient } from "@/lib/supabase/server";
import { schedule, slotLabel, TIMEZONE } from "@/lib/schedule";

/** YYYY-MM-DD → Excel Date at noon UTC (date-only cell). */
function excelDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Extract Beirut wall-clock time from ISO → Excel time Date. */
function excelTimeFromIso(iso: string | null | undefined): Date | "" {
  if (!iso) return "";
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  );
  const h = Number(parts.hour === "24" ? "0" : parts.hour);
  const min = Number(parts.minute);
  return new Date(Date.UTC(1899, 11, 30, h, min, 0));
}

function templateDuration(mins: number | null | undefined): string {
  if (mins == null || Number.isNaN(mins)) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}hr`;
  return `${h}hr ${m}min`;
}

const BLUE_SEP: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF0070C0" },
};

const TUTOR_HEADERS = [
  "date",
  "tutor name",
  "scheduled shift",
  "Team Options2",
  "actual time in",
  "actual time out",
  "total hrs",
  "Notes",
] as const;

const TUTOREE_HEADERS = [
  "date",
  "std name",
  "std email",
  "time in",
  "time out",
  "duration",
  "course",
  "tutor who helped",
  "notes",
] as const;

const TUTOR_WIDTHS = [21, 25.14, 22.14, 16.86, 25.57, 17.43, 15, 33.43];
const TUTOREE_WIDTHS = [24, 15, 21, 22, 21, 10, 22, 28, 34];

async function loadTemplateWorkbook(): Promise<ExcelJS.Workbook> {
  const file = path.join(
    process.cwd(),
    "src",
    "data",
    "attendance-template.xlsx",
  );
  const buf = await fs.readFile(file);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  return wb;
}

function fillScheduleSheet(ws: ExcelJS.Worksheet) {
  const title =
    schedule.title || "ETC General Tutoring Schedule (All Courses)";
  ws.getCell(1, 1).value = title;

  const days = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
  const allSlots = new Set<string>();
  for (const d of days) {
    Object.keys(schedule.days[d] ?? {}).forEach((s) => allSlots.add(s));
  }
  const slots = Array.from(allSlots).sort();

  for (let i = 0; i < slots.length; i++) {
    const rowIdx = 3 + i;
    const slot = slots[i];
    const row = ws.getRow(rowIdx);
    row.getCell(1).value = slotLabel(slot);
    for (let c = 0; c < days.length; c++) {
      const tutors = schedule.days[days[c]]?.[slot] ?? [];
      row.getCell(c + 2).value = tutors
        .map((t) =>
          t.courses.length
            ? `${t.name} (${t.courses.join(", ")})`
            : t.name,
        )
        .join("\n");
    }
    row.commit();
  }
}

/**
 * Drop and recreate a data sheet. ExcelJS spliceRows leaves stale rows/tables
 * that produce files Excel cannot open.
 */
function replaceSheet(
  wb: ExcelJS.Workbook,
  name: string,
  widths: number[],
): ExcelJS.Worksheet {
  const existing = wb.getWorksheet(name);
  if (existing) {
    try {
      const tables =
        (existing as unknown as { tables?: Record<string, unknown> }).tables ??
        {};
      for (const key of Object.keys(tables)) {
        existing.removeTable(key);
      }
    } catch {
      /* ignore */
    }
    wb.removeWorksheet(existing.id);
  }
  const ws = wb.addWorksheet(name);
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
  return ws;
}

function tutorNameFromJoin(
  tutors:
    | { name?: string }
    | { name?: string }[]
    | null
    | undefined,
): string {
  if (!tutors) return "";
  if (Array.isArray(tutors)) return tutors[0]?.name ?? "";
  return tutors.name ?? "";
}

export async function buildAttendanceWorkbook(from: string, to: string) {
  const supabase = await createClient();

  const [{ data: attendance, error: aErr }, { data: visits, error: vErr }] =
    await Promise.all([
      supabase
        .from("tutor_attendance")
        .select(
          "attendance_date, scheduled_shift, role, time_in, time_out, total_hours, notes, tutors(name)",
        )
        .gte("attendance_date", from)
        .lte("attendance_date", to)
        .order("attendance_date")
        .order("time_in"),
      supabase
        .from("student_visits")
        .select(
          "visit_date, student_name, student_email, time_in, time_out, duration_minutes, course, notes, tutors(name)",
        )
        .gte("visit_date", from)
        .lte("visit_date", to)
        .order("visit_date")
        .order("time_in"),
    ]);

  if (aErr) throw new Error(aErr.message);
  if (vErr) throw new Error(vErr.message);

  const wb = await loadTemplateWorkbook();
  wb.creator = "ETC Operations";
  wb.created = new Date();

  const sched = wb.getWorksheet("General schedule");
  if (sched) fillScheduleSheet(sched);

  // --- Tutors ---
  const tutorsSheet = replaceSheet(wb, "Tutors", TUTOR_WIDTHS);
  const headerTutor = tutorsSheet.getRow(1);
  headerTutor.values = [undefined, ...TUTOR_HEADERS];
  headerTutor.font = { name: "Calibri", size: 11 };
  headerTutor.commit();

  let lastDate = "";
  let excelRowIdx = 1;

  for (const row of attendance ?? []) {
    const name = tutorNameFromJoin(
      row.tutors as { name?: string } | { name?: string }[] | null,
    );

    if (lastDate && lastDate !== row.attendance_date) {
      excelRowIdx += 1;
      const sep = tutorsSheet.getRow(excelRowIdx);
      for (let c = 1; c <= 8; c++) {
        sep.getCell(c).value = null;
        sep.getCell(c).fill = BLUE_SEP;
      }
      sep.font = { name: "Calibri", size: 11 };
      sep.commit();
    }
    lastDate = row.attendance_date;

    excelRowIdx += 1;
    const excelRow = tutorsSheet.getRow(excelRowIdx);
    excelRow.values = [
      undefined,
      excelDate(row.attendance_date),
      name,
      row.scheduled_shift ?? "",
      row.role ?? "Tutor",
      excelTimeFromIso(row.time_in),
      excelTimeFromIso(row.time_out),
      row.total_hours ?? "",
      row.notes ?? "",
    ];
    excelRow.font = { name: "Calibri", size: 11 };
    excelRow.getCell(1).numFmt = "mm-dd-yy";
    excelRow.getCell(5).numFmt = "h:mm";
    excelRow.getCell(6).numFmt = "h:mm";
    if (typeof row.total_hours === "number") {
      excelRow.getCell(7).numFmt = "0.##";
    }
    excelRow.commit();
  }

  // --- Tutoree ---
  const tutoree = replaceSheet(wb, "Tutoree", TUTOREE_WIDTHS);
  const headerVisit = tutoree.getRow(1);
  headerVisit.values = [undefined, ...TUTOREE_HEADERS];
  headerVisit.font = { name: "Calibri", size: 11 };
  headerVisit.commit();

  let r = 1;
  for (const row of visits ?? []) {
    const helper = tutorNameFromJoin(
      row.tutors as { name?: string } | { name?: string }[] | null,
    );
    r += 1;
    const email = (row.student_email ?? "").trim();
    const excelRow = tutoree.getRow(r);
    excelRow.values = [
      undefined,
      excelDate(row.visit_date),
      row.student_name,
      email ? { text: email, hyperlink: `mailto:${email}` } : "",
      excelTimeFromIso(row.time_in),
      excelTimeFromIso(row.time_out),
      templateDuration(row.duration_minutes),
      row.course ?? "",
      helper,
      row.notes ?? "",
    ];
    excelRow.font = { name: "Calibri", size: 11 };
    excelRow.getCell(1).numFmt = "mm-dd-yy";
    excelRow.getCell(4).numFmt = "h:mm";
    excelRow.getCell(5).numFmt = "h:mm";
    if (email) {
      excelRow.getCell(3).font = {
        name: "Calibri",
        size: 11,
        underline: true,
        color: { theme: 10 },
      };
    }
    excelRow.commit();
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
