"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { TutorSheetRow, VisitSheetRow } from "@/lib/data-editor";

type Tab = "tutors" | "students";

type TutorDraft = TutorSheetRow & {
  isNew?: boolean;
  dirty?: boolean;
  saving?: boolean;
  error?: string;
};

type VisitDraft = VisitSheetRow & {
  isNew?: boolean;
  dirty?: boolean;
  saving?: boolean;
  error?: string;
};

const TUTOR_COLS = [
  "date",
  "tutorName",
  "scheduledShift",
  "role",
  "timeIn",
  "timeOut",
  "notes",
] as const;

const VISIT_COLS = [
  "date",
  "studentName",
  "studentEmail",
  "timeIn",
  "timeOut",
  "course",
  "tutorName",
  "notes",
] as const;

const TUTOR_HEADERS: Record<(typeof TUTOR_COLS)[number], string> = {
  date: "Date",
  tutorName: "Tutor name",
  scheduledShift: "Scheduled shift",
  role: "Role",
  timeIn: "Time in",
  timeOut: "Time out",
  notes: "Notes",
};

const VISIT_HEADERS: Record<(typeof VISIT_COLS)[number], string> = {
  date: "Date",
  studentName: "Student name",
  studentEmail: "Email",
  timeIn: "Time in",
  timeOut: "Time out",
  course: "Course",
  tutorName: "Tutor who helped",
  notes: "Notes",
};

function emptyTutorRow(date: string): TutorDraft {
  return {
    id: `new-${Date.now()}`,
    isNew: true,
    dirty: true,
    date,
    tutorId: "",
    tutorName: "",
    scheduledShift: "",
    role: "Tutor",
    timeIn: "13:00",
    timeOut: "",
    totalHours: null,
    notes: "",
  };
}

function emptyVisitRow(date: string): VisitDraft {
  return {
    id: `new-${Date.now()}`,
    isNew: true,
    dirty: true,
    date,
    studentName: "",
    studentEmail: "",
    timeIn: "13:00",
    timeOut: "",
    durationMinutes: null,
    course: "",
    tutorId: null,
    tutorName: "",
    notes: "",
  };
}

function mapTutorFromApi(row: Record<string, unknown>): TutorDraft {
  const tutors = row.tutors as { id?: string; name?: string } | null;
  const name = tutors?.name ?? "";
  const timeIn = row.time_in as string;
  const timeOut = row.time_out as string | null;
  return {
    id: String(row.id),
    date: String(row.attendance_date),
    tutorId: String(row.tutor_id),
    tutorName: name,
    scheduledShift: String(row.scheduled_shift ?? ""),
    role: String(row.role ?? "Tutor"),
    timeIn: formatTimeFromIso(timeIn),
    timeOut: timeOut ? formatTimeFromIso(timeOut) : "",
    totalHours: (row.total_hours as number | null) ?? null,
    notes: String(row.notes ?? ""),
    dirty: false,
  };
}

function mapVisitFromApi(row: Record<string, unknown>): VisitDraft {
  const tutors = row.tutors as { name?: string } | null;
  const timeIn = row.time_in as string;
  const timeOut = row.time_out as string | null;
  return {
    id: String(row.id),
    date: String(row.visit_date),
    studentName: String(row.student_name),
    studentEmail: String(row.student_email ?? ""),
    timeIn: formatTimeFromIso(timeIn),
    timeOut: timeOut ? formatTimeFromIso(timeOut) : "",
    durationMinutes: (row.duration_minutes as number | null) ?? null,
    course: String(row.course ?? ""),
    tutorId: row.tutor_id ? String(row.tutor_id) : null,
    tutorName: tutors?.name ?? "",
    notes: String(row.notes ?? ""),
    dirty: false,
  };
}

function formatTimeFromIso(iso: string): string {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Beirut",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(d).map((p) => [p.type, p.value]),
  );
  const h = parts.hour === "24" ? "00" : parts.hour;
  return `${h}:${parts.minute}`;
}

export function SpreadsheetClient({ today }: { today: string }) {
  const [tab, setTab] = useState<Tab>("tutors");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [tutors, setTutors] = useState<TutorDraft[]>([]);
  const [visits, setVisits] = useState<VisitDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/data-editor?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Load failed");
      setTutors(json.tutors ?? []);
      setVisits(json.visits ?? []);
      setToast(
        `Loaded ${json.tutors?.length ?? 0} tutor + ${json.visits?.length ?? 0} student rows`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(id);
  }, [toast]);

  async function saveTutor(row: TutorDraft) {
    setTutors((rows) =>
      rows.map((r) => (r.id === row.id ? { ...r, saving: true, error: undefined } : r)),
    );
    try {
      const res = await fetch("/api/data-editor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_tutor",
          row: {
            id: row.isNew ? null : row.id,
            date: row.date,
            tutorId: row.tutorId,
            tutorName: row.tutorName,
            scheduledShift: row.scheduledShift,
            role: row.role,
            timeIn: row.timeIn,
            timeOut: row.timeOut,
            notes: row.notes,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      const saved = mapTutorFromApi(json.row);
      setTutors((rows) =>
        rows.map((r) => (r.id === row.id ? saved : r)),
      );
      setToast("Tutor row saved — linked to live data");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed";
      setTutors((rows) =>
        rows.map((r) =>
          r.id === row.id ? { ...r, saving: false, error: msg } : r,
        ),
      );
    }
  }

  async function saveVisit(row: VisitDraft) {
    setVisits((rows) =>
      rows.map((r) => (r.id === row.id ? { ...r, saving: true, error: undefined } : r)),
    );
    try {
      const res = await fetch("/api/data-editor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_visit",
          row: {
            id: row.isNew ? null : row.id,
            date: row.date,
            studentName: row.studentName,
            studentEmail: row.studentEmail,
            timeIn: row.timeIn,
            timeOut: row.timeOut,
            course: row.course,
            tutorId: row.tutorId,
            tutorName: row.tutorName,
            notes: row.notes,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      const saved = mapVisitFromApi(json.row);
      setVisits((rows) =>
        rows.map((r) => (r.id === row.id ? saved : r)),
      );
      setToast("Student row saved — linked to live data");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed";
      setVisits((rows) =>
        rows.map((r) =>
          r.id === row.id ? { ...r, saving: false, error: msg } : r,
        ),
      );
    }
  }

  async function deleteTutor(row: TutorDraft) {
    if (row.isNew) {
      setTutors((rows) => rows.filter((r) => r.id !== row.id));
      return;
    }
    if (!window.confirm("Delete this tutor attendance row?")) return;
    const res = await fetch("/api/data-editor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_tutor", id: row.id }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Delete failed");
      return;
    }
    setTutors((rows) => rows.filter((r) => r.id !== row.id));
    setToast("Row deleted");
  }

  async function deleteVisit(row: VisitDraft) {
    if (row.isNew) {
      setVisits((rows) => rows.filter((r) => r.id !== row.id));
      return;
    }
    if (!window.confirm("Delete this student visit row?")) return;
    const res = await fetch("/api/data-editor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_visit", id: row.id }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Delete failed");
      return;
    }
    setVisits((rows) => rows.filter((r) => r.id !== row.id));
    setToast("Row deleted");
  }

  function updateTutor(id: string, field: keyof TutorDraft, value: string) {
    setTutors((rows) =>
      rows.map((r) =>
        r.id === id ? { ...r, [field]: value, dirty: true, error: undefined } : r,
      ),
    );
  }

  function updateVisit(id: string, field: keyof VisitDraft, value: string) {
    setVisits((rows) =>
      rows.map((r) =>
        r.id === id ? { ...r, [field]: value, dirty: true, error: undefined } : r,
      ),
    );
  }

  const cellClass =
    "min-w-[7rem] border-0 bg-transparent px-2 py-1.5 text-sm text-ink focus:bg-brand-soft focus:outline-none focus:ring-1 focus:ring-brand";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="text-sm font-medium text-muted">From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="input-field mt-1 min-h-11"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-muted">To</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="input-field mt-1 min-h-11"
          />
        </label>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="btn-primary"
        >
          {loading ? "Loading…" : "Load data"}
        </button>
        <Link href="/desk/export" className="btn-secondary">
          Download Excel
        </Link>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      {toast ? (
        <p className="rounded-lg border border-brand/20 bg-brand/5 px-4 py-3 text-sm text-brand-ink" role="status">
          {toast}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("tutors")}
          className={`min-h-10 rounded-lg px-4 text-sm font-semibold focus-ring ${
            tab === "tutors" ? "bg-brand text-white" : "border border-border bg-surface text-muted"
          }`}
        >
          Tutors sheet
        </button>
        <button
          type="button"
          onClick={() => setTab("students")}
          className={`min-h-10 rounded-lg px-4 text-sm font-semibold focus-ring ${
            tab === "students" ? "bg-brand text-white" : "border border-border bg-surface text-muted"
          }`}
        >
          Students sheet
        </button>
      </div>

      <p className="text-sm text-muted">
        Edit cells like Excel — each row saves to the same database as the desk and
        export. Changes appear on the desk immediately after saving.
      </p>

      {tab === "tutors" ? (
        <div className="overflow-x-auto surface-panel">
          <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-bg text-xs uppercase tracking-wide text-muted">
                {TUTOR_COLS.map((c) => (
                  <th key={c} className="px-2 py-2 font-semibold">
                    {TUTOR_HEADERS[c]}
                  </th>
                ))}
                <th className="px-2 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading && tutors.length === 0 ? (
                <tr>
                  <td
                    colSpan={TUTOR_COLS.length + 1}
                    className="px-4 py-8 text-center text-muted"
                  >
                    No tutor rows in this date range. Add one below or widen the
                    range.
                  </td>
                </tr>
              ) : null}
              {tutors.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-border ${row.dirty ? "bg-brand-soft/30" : ""}`}
                >
                  {TUTOR_COLS.map((col) => (
                    <td key={col} className="p-0">
                      <input
                        type={col === "date" ? "date" : "text"}
                        value={String(row[col] ?? "")}
                        onChange={(e) => updateTutor(row.id, col, e.target.value)}
                        className={cellClass}
                        placeholder={col === "timeIn" ? "13:00" : undefined}
                      />
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-2 py-1">
                    <button
                      type="button"
                      disabled={row.saving}
                      onClick={() => void saveTutor(row)}
                      className="mr-2 text-xs font-semibold text-brand-ink hover:underline focus-ring rounded"
                    >
                      {row.saving ? "…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteTutor(row)}
                      className="text-xs font-semibold text-muted hover:text-red-700 focus-ring rounded"
                    >
                      Delete
                    </button>
                    {row.error ? (
                      <p className="mt-1 text-xs text-red-600">{row.error}</p>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-border p-3">
            <button
              type="button"
              onClick={() => setTutors((rows) => [...rows, emptyTutorRow(from)])}
              className="btn-secondary text-sm"
            >
              + Add tutor row
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto surface-panel">
          <table className="w-full min-w-[64rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-bg text-xs uppercase tracking-wide text-muted">
                {VISIT_COLS.map((c) => (
                  <th key={c} className="px-2 py-2 font-semibold">
                    {VISIT_HEADERS[c]}
                  </th>
                ))}
                <th className="px-2 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading && visits.length === 0 ? (
                <tr>
                  <td
                    colSpan={VISIT_COLS.length + 1}
                    className="px-4 py-8 text-center text-muted"
                  >
                    No student rows in this date range. Add one below or widen
                    the range.
                  </td>
                </tr>
              ) : null}
              {visits.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-border ${row.dirty ? "bg-brand-soft/30" : ""}`}
                >
                  {VISIT_COLS.map((col) => (
                    <td key={col} className="p-0">
                      <input
                        type={col === "date" ? "date" : "text"}
                        value={String(row[col] ?? "")}
                        onChange={(e) => updateVisit(row.id, col, e.target.value)}
                        className={cellClass}
                      />
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-2 py-1">
                    <button
                      type="button"
                      disabled={row.saving}
                      onClick={() => void saveVisit(row)}
                      className="mr-2 text-xs font-semibold text-brand-ink hover:underline focus-ring rounded"
                    >
                      {row.saving ? "…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteVisit(row)}
                      className="text-xs font-semibold text-muted hover:text-red-700 focus-ring rounded"
                    >
                      Delete
                    </button>
                    {row.error ? (
                      <p className="mt-1 text-xs text-red-600">{row.error}</p>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-border p-3">
            <button
              type="button"
              onClick={() => setVisits((rows) => [...rows, emptyVisitRow(from)])}
              className="btn-secondary text-sm"
            >
              + Add student row
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
