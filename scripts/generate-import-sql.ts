import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseTutorsCsv } from "../src/lib/excel-import";

function esc(s: string) {
  return s.replace(/'/g, "''");
}

const csvPath = path.join(process.cwd(), "src", "data", "tutors-history.csv");
const csv = readFileSync(csvPath, "utf8");
const { tutors } = parseTutorsCsv(csv);
const names = [...new Set(tutors.map((t) => t.name))].sort();

let sql = "BEGIN;\nDELETE FROM student_visits;\nDELETE FROM tutor_attendance;\n";
for (const name of names) {
  sql += `INSERT INTO tutors (name, courses, active) VALUES ('${esc(name)}', '[]'::jsonb, true) ON CONFLICT (name) DO NOTHING;\n`;
}
const timeInKeys = new Map<string, number>();
for (const row of tutors) {
  const baseKey = `${row.date}|${row.name.toLowerCase()}|${row.timeIn}`;
  const bump = timeInKeys.get(baseKey) ?? 0;
  timeInKeys.set(baseKey, bump + 1);
  let storedTimeIn = row.timeIn!;
  if (bump > 0) {
    const d = new Date(storedTimeIn);
    d.setSeconds(d.getSeconds() + bump);
    storedTimeIn = d.toISOString();
  }
  const timeOut = row.timeOut ? `'${row.timeOut}'::timestamptz` : "NULL";
  const total = row.totalHours != null ? String(row.totalHours) : "NULL";
  sql += `INSERT INTO tutor_attendance (attendance_date, tutor_id, scheduled_shift, role, time_in, time_out, total_hours, notes, created_by) SELECT '${row.date}'::date, id, '${esc(row.scheduledShift)}', '${esc(row.role)}', '${storedTimeIn}'::timestamptz, ${timeOut}, ${total}, '${esc(row.notes)}', 'csv-import' FROM tutors WHERE lower(name) = lower('${esc(row.name)}');\n`;
}
sql += "COMMIT;\n";

const out = process.argv[2] ?? "/tmp/tutors-import.sql";
writeFileSync(out, sql);
console.log(JSON.stringify({ out, bytes: sql.length, rows: tutors.length, tutors: names.length }));
