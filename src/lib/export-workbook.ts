import ExcelJS from "exceljs";
import JSZip from "jszip";
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

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF2C3E50" },
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

const SCHEDULE_HEADERS = [
  "Time",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
] as const;

const TUTOR_WIDTHS = [12, 22, 16, 14, 14, 14, 10, 28];
const TUTOREE_WIDTHS = [12, 18, 24, 10, 10, 10, 18, 22, 24];
const SCHEDULE_WIDTHS = [14, 28, 28, 28, 28, 28];

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

function styleHeaderRow(row: ExcelJS.Row, colCount: number) {
  row.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = HEADER_FILL;
  for (let c = 1; c <= colCount; c++) {
    row.getCell(c).fill = HEADER_FILL;
    row.getCell(c).font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
  }
}

function buildScheduleSheet(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet("General schedule");
  SCHEDULE_WIDTHS.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  const title =
    schedule.title || "ETC General Tutoring Schedule (All Courses)";
  ws.getCell(1, 1).value = title;
  ws.getCell(1, 1).font = { name: "Calibri", size: 14, bold: true };
  ws.mergeCells(1, 1, 1, 6);

  const header = ws.getRow(2);
  header.values = [...SCHEDULE_HEADERS];
  styleHeaderRow(header, 6);
  header.commit();

  const days = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
  const allSlots = new Set<string>();
  for (const d of days) {
    Object.keys(schedule.days[d] ?? {}).forEach((s) => allSlots.add(s));
  }
  const slots = Array.from(allSlots).sort();

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const row = ws.getRow(3 + i);
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
      row.getCell(c + 2).alignment = { wrapText: true, vertical: "top" };
    }
    row.font = { name: "Calibri", size: 11 };
    row.commit();
  }
}

/**
 * Excel Desktop rejects some ExcelJS packages that include empty ZIP
 * directory entries and leftover Content_Types defaults (e.g. vml) with
 * no matching parts. Rewrite the archive as files-only.
 */
async function sanitizeXlsxForExcel(buffer: Buffer): Promise<Buffer> {
  const incoming = await JSZip.loadAsync(buffer);
  const outgoing = new JSZip();

  const names = Object.keys(incoming.files).sort();
  for (const name of names) {
    const entry = incoming.files[name];
    if (!entry || entry.dir || name.endsWith("/")) continue;

    let data = await entry.async("nodebuffer");
    if (name === "[Content_Types].xml") {
      // Drop unused Default Extension="vml" left by template-derived writes.
      data = Buffer.from(
        data
          .toString("utf8")
          .replace(/<Default[^>]*Extension="vml"[^>]*\/>/g, ""),
        "utf8",
      );
    }
    // createFolders:false avoids empty ZIP directory entries that Excel
    // Desktop frequently reports as "file is corrupt".
    outgoing.file(name, data, { createFolders: false });
  }

  const out = await outgoing.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  return Buffer.from(out);
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

  // Build from scratch — cloning the SharePoint attendance template via
  // ExcelJS leaves slicer/#N/A names, vml Content_Types, and ZIP directory
  // entries that Microsoft Excel reports as corrupt.
  const wb = new ExcelJS.Workbook();
  wb.creator = "ETC Operations";
  wb.created = new Date();
  wb.modified = new Date();

  buildScheduleSheet(wb);

  const tutorsSheet = wb.addWorksheet("Tutors");
  TUTOR_WIDTHS.forEach((w, i) => {
    tutorsSheet.getColumn(i + 1).width = w;
  });
  const headerTutor = tutorsSheet.getRow(1);
  headerTutor.values = [...TUTOR_HEADERS];
  styleHeaderRow(headerTutor, TUTOR_HEADERS.length);
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
      for (let c = 1; c <= TUTOR_HEADERS.length; c++) {
        sep.getCell(c).value = null;
        sep.getCell(c).fill = BLUE_SEP;
      }
      sep.commit();
    }
    lastDate = row.attendance_date;

    excelRowIdx += 1;
    const excelRow = tutorsSheet.getRow(excelRowIdx);
    excelRow.values = [
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

  const tutoree = wb.addWorksheet("Tutoree");
  TUTOREE_WIDTHS.forEach((w, i) => {
    tutoree.getColumn(i + 1).width = w;
  });
  const headerVisit = tutoree.getRow(1);
  headerVisit.values = [...TUTOREE_HEADERS];
  styleHeaderRow(headerVisit, TUTOREE_HEADERS.length);
  headerVisit.commit();

  let r = 1;
  for (const row of visits ?? []) {
    const helper = tutorNameFromJoin(
      row.tutors as { name?: string } | { name?: string }[] | null,
    );
    r += 1;
    const email = (row.student_email ?? "").trim();
    const excelRow = tutoree.getRow(r);
    // Plain text email (no mailto hyperlink) — hyperlink rels from ExcelJS
    // have triggered Excel repair dialogs on some builds.
    excelRow.values = [
      excelDate(row.visit_date),
      row.student_name,
      email,
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
    excelRow.commit();
  }

  const raw = Buffer.from(await wb.xlsx.writeBuffer());
  return sanitizeXlsxForExcel(raw);
}
