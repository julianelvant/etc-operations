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

async function loadTemplateWorkbook(): Promise<ExcelJS.Workbook> {
  const file = path.join(
    process.cwd(),
    "src",
    "data",
    "attendance-template.xlsx",
  );
  const buf = await fs.readFile(file);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Uint8Array.from(buf).buffer);
  return wb;
}

function clearDataRows(ws: ExcelJS.Worksheet, headerRows = 1) {
  const last = ws.rowCount;
  if (last > headerRows) {
    ws.spliceRows(headerRows + 1, last - headerRows);
  }
}

function fillScheduleSheet(ws: ExcelJS.Worksheet) {
  // Keep title + header styled; rewrite body values from schedule.json
  const title =
    schedule.title || "ETC General Tutoring Schedule (All Courses)";
  ws.getCell(1, 1).value = title;

  const days = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
  const allSlots = new Set<string>();
  for (const d of days) {
    Object.keys(schedule.days[d] ?? {}).forEach((s) => allSlots.add(s));
  }
  const slots = Array.from(allSlots).sort();

  // Template has rows 3..6 for four slots — write into those (or extend)
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

  const tutorsSheet = wb.getWorksheet("Tutors");
  if (tutorsSheet) {
    try {
      tutorsSheet.removeTable("Table3");
    } catch {
      /* table may be absent after load quirks */
    }
    clearDataRows(tutorsSheet, 1);

    let lastDate = "";
    let excelRowIdx = 1;
    for (const row of attendance ?? []) {
      const joined = row.tutors as
        | { name?: string }
        | { name?: string }[]
        | null;
      const tutorName = Array.isArray(joined)
        ? (joined[0]?.name ?? "")
        : (joined?.name ?? "");

      if (lastDate && lastDate !== row.attendance_date) {
        excelRowIdx += 1;
        const sep = tutorsSheet.getRow(excelRowIdx);
        for (let c = 1; c <= 8; c++) {
          sep.getCell(c).value = null;
          sep.getCell(c).fill = BLUE_SEP;
        }
        sep.commit();
      }
      lastDate = row.attendance_date;

      excelRowIdx += 1;
      const excelRow = tutorsSheet.getRow(excelRowIdx);
      excelRow.values = [
        ,
        excelDate(row.attendance_date),
        tutorName,
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

    const lastData = Math.max(excelRowIdx, 1);
    if (lastData > 1) {
      // ExcelJS TableProperties requires `rows`; data already written to sheet.
      (
        tutorsSheet as ExcelJS.Worksheet & {
          addTable: (t: Record<string, unknown>) => void;
        }
      ).addTable({
        name: "Table3",
        ref: `A1:H${lastData}`,
        headerRow: true,
        style: {
          theme: "TableStyleMedium2",
          showRowStripes: false,
        },
        columns: [
          { name: "date" },
          { name: "tutor name" },
          { name: "scheduled shift" },
          { name: "Team Options2" },
          { name: "actual time in" },
          { name: "actual time out" },
          { name: "total hrs" },
          { name: "Notes" },
        ],
        rows: [],
      });
    }
  }

  const tutoree = wb.getWorksheet("Tutoree");
  if (tutoree) {
    try {
      tutoree.removeTable("Table2");
    } catch {
      /* ok */
    }
    clearDataRows(tutoree, 1);

    let r = 1;
    for (const row of visits ?? []) {
      const joined = row.tutors as
        | { name?: string }
        | { name?: string }[]
        | null;
      const helper = Array.isArray(joined)
        ? (joined[0]?.name ?? "")
        : (joined?.name ?? "");
      r += 1;
      const excelRow = tutoree.getRow(r);
      const email = (row.student_email ?? "").trim();
      excelRow.values = [
        ,
        excelDate(row.visit_date),
        row.student_name,
        email
          ? { text: email, hyperlink: `mailto:${email}` }
          : "",
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

    const lastData = Math.max(r, 1);
    if (lastData > 1) {
      (
        tutoree as ExcelJS.Worksheet & {
          addTable: (t: Record<string, unknown>) => void;
        }
      ).addTable({
        name: "Table2",
        ref: `A1:I${lastData}`,
        headerRow: true,
        style: {
          theme: "TableStyleMedium2",
          showRowStripes: false,
        },
        columns: [
          { name: "date" },
          { name: "std name" },
          { name: "std email" },
          { name: "time in" },
          { name: "time out" },
          { name: "duration" },
          { name: "course" },
          { name: "tutor who helped" },
          { name: "notes" },
        ],
        rows: [],
      });
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
