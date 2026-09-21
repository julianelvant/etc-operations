import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { schedule, slotLabel, TIMEZONE } from "@/lib/schedule";

/** YYYY-MM-DD → Excel Date at noon UTC (date-only cell). */
function excelDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Extract Beirut wall-clock time from ISO → Excel time fraction (hours/24). */
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
  let h = Number(parts.hour === "24" ? "0" : parts.hour);
  const min = Number(parts.minute);
  // ExcelJS time: use Date with UTC time components
  const d = new Date(Date.UTC(1899, 11, 30, h, min, 0));
  return d;
}

function templateDuration(mins: number | null | undefined): string {
  if (mins == null || Number.isNaN(mins)) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}hr`;
  return `${h}hr ${m}min`;
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

  const wb = new ExcelJS.Workbook();
  wb.creator = "ETC Operations";
  wb.created = new Date();

  // --- General schedule (match template layout) ---
  const sched = wb.addWorksheet("General schedule");
  sched.addRow([
    schedule.title || "ETC General Tutoring Schedule (All Courses)",
  ]);
  sched.mergeCells(1, 1, 1, 6);
  sched.getRow(1).font = { bold: true, size: 14 };
  sched.addRow([
    "Time/Day",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
  ]);
  sched.getRow(2).font = { bold: true };

  const days = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
  const allSlots = new Set<string>();
  for (const d of days) {
    Object.keys(schedule.days[d] ?? {}).forEach((s) => allSlots.add(s));
  }
  for (const slot of Array.from(allSlots).sort()) {
    const row: string[] = [slotLabel(slot)];
    for (const d of days) {
      const tutors = schedule.days[d]?.[slot] ?? [];
      row.push(
        tutors
          .map((t) =>
            t.courses.length
              ? `${t.name} (${t.courses.join(", ")})`
              : t.name,
          )
          .join("\n"),
      );
    }
    const excelRow = sched.addRow(row);
    excelRow.alignment = { wrapText: true, vertical: "top" };
  }
  sched.getColumn(1).width = 18;
  for (let c = 2; c <= 6; c++) sched.getColumn(c).width = 40;

  // --- Tutors ---
  const tutorsSheet = wb.addWorksheet("Tutors");
  tutorsSheet.addRow([
    "date",
    "tutor name",
    "scheduled shift",
    "Team Options2",
    "actual time in",
    "actual time out",
    "total hrs",
    "Notes",
  ]);
  tutorsSheet.getRow(1).font = { bold: true };

  for (const row of attendance ?? []) {
    const joined = row.tutors as
      | { name?: string }
      | { name?: string }[]
      | null;
    const tutorName = Array.isArray(joined)
      ? (joined[0]?.name ?? "")
      : (joined?.name ?? "");
    const excelRow = tutorsSheet.addRow([
      excelDate(row.attendance_date),
      tutorName,
      row.scheduled_shift ?? "",
      row.role ?? "Tutor",
      excelTimeFromIso(row.time_in),
      excelTimeFromIso(row.time_out),
      row.total_hours ?? "",
      row.notes ?? "",
    ]);
    excelRow.getCell(1).numFmt = "yyyy-mm-dd";
    excelRow.getCell(5).numFmt = "h:mm";
    excelRow.getCell(6).numFmt = "h:mm";
    if (typeof row.total_hours === "number") {
      excelRow.getCell(7).numFmt = "0.##";
    }
  }
  const tutorWidths = [12, 22, 18, 14, 14, 14, 10, 28];
  tutorWidths.forEach((w, i) => {
    tutorsSheet.getColumn(i + 1).width = w;
  });

  // --- Tutoree ---
  const tutoree = wb.addWorksheet("Tutoree");
  tutoree.addRow([
    "date",
    "std name",
    "std email",
    "time in",
    "time out",
    "duration",
    "course",
    "tutor who helped",
    "notes",
  ]);
  tutoree.getRow(1).font = { bold: true };

  for (const row of visits ?? []) {
    const joined = row.tutors as
      | { name?: string }
      | { name?: string }[]
      | null;
    const helper = Array.isArray(joined)
      ? (joined[0]?.name ?? "")
      : (joined?.name ?? "");
    const excelRow = tutoree.addRow([
      excelDate(row.visit_date),
      row.student_name,
      row.student_email ?? "",
      excelTimeFromIso(row.time_in),
      excelTimeFromIso(row.time_out),
      templateDuration(row.duration_minutes),
      row.course ?? "",
      helper,
      row.notes ?? "",
    ]);
    excelRow.getCell(1).numFmt = "yyyy-mm-dd";
    excelRow.getCell(4).numFmt = "h:mm";
    excelRow.getCell(5).numFmt = "h:mm";
  }
  const visitWidths = [12, 18, 24, 10, 10, 12, 14, 20, 28];
  visitWidths.forEach((w, i) => {
    tutoree.getColumn(i + 1).width = w;
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
