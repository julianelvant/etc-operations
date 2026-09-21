"use client";

import { useState } from "react";

type Summary = {
  tutorsCreated: number;
  attendanceInserted: number;
  attendanceSkipped: number;
  visitsInserted: number;
  visitsSkipped: number;
  warnings: string[];
};

export function ImportExcelHistoryButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  async function runImport() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/import/attendance", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import failed");
      const s = json.summary as Summary;
      setSummary(s);
      setMessage(
        `Imported ${s.attendanceInserted} tutor rows, ${s.visitsInserted} visits` +
          (s.attendanceSkipped || s.visitsSkipped
            ? ` (${s.attendanceSkipped + s.visitsSkipped} skipped as duplicates)`
            : "") +
          (s.tutorsCreated ? `; created ${s.tutorsCreated} tutors` : ""),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <h2 className="font-display text-lg font-semibold text-slate-900">
        Excel history
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Load Sep 14–18 attendance from the committed template workbook into
        Supabase. Safe to re-run — duplicate date + tutor + time-in rows are
        skipped.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void runImport()}
        className="mt-4 inline-flex min-h-11 items-center rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
      >
        {busy ? "Importing…" : "Import Excel history"}
      </button>
      {message ? (
        <p className="mt-3 text-sm text-emerald-800" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
      {summary?.warnings?.length ? (
        <details className="mt-3 text-xs text-slate-500">
          <summary className="cursor-pointer font-medium">
            {summary.warnings.length} warning
            {summary.warnings.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {summary.warnings.slice(0, 40).map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
