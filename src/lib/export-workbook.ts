import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import {
  formatClock,
  formatDurationMinutes,
  schedule,
  slotLabel,
  TIMEZONE,
} from "@/lib/schedule";

function formatDateBeirut(isoDate: string) {
  // isoDate is YYYY-MM-DD
  const d = new Date(`${isoDate}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
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

  // --- General schedule ---
  const sched = wb.addWorksheet("General schedule");
  sched.addRow([schedule.title]);
  sched.mergeCells(1, 1, 1, 6);
  const header = ["Time/Day", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  sched.addRow(header);
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
    sched.addRow(row);
  }
  sched.getColumn(1).width = 18;
  for (let c = 2; c <= 6; c++) sched.getColumn(c).width = 36;

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
  for (const row of attendance ?? []) {
    const joined = row.tutors as
      | { name?: string }
      | { name?: string }[]
      | null;
    const tutorName = Array.isArray(joined)
      ? joined[0]?.name ?? ""
      : joined?.name ?? "";
    tutorsSheet.addRow([
      formatDateBeirut(row.attendance_date),
      tutorName,
      row.scheduled_shift ?? "",
      row.role ?? "Tutor",
      formatClock(row.time_in),
      formatClock(row.time_out),
      row.total_hours ?? "",
      row.notes ?? "",
    ]);
  }
  tutorsSheet.columns.forEach((col) => {
    col.width = 16;
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
  for (const row of visits ?? []) {
    const joined = row.tutors as
      | { name?: string }
      | { name?: string }[]
      | null;
    const helper = Array.isArray(joined)
      ? joined[0]?.name ?? ""
      : joined?.name ?? "";
    tutoree.addRow([
      formatDateBeirut(row.visit_date),
      row.student_name,
      row.student_email ?? "",
      formatClock(row.time_in),
      formatClock(row.time_out),
      formatDurationMinutes(row.duration_minutes),
      row.course ?? "",
      helper,
      row.notes ?? "",
    ]);
  }
  tutoree.columns.forEach((col) => {
    col.width = 16;
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
