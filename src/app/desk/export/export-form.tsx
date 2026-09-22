"use client";

import { useMemo, useState } from "react";

export function ExportForm({ today }: { today: string }) {
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rangeInvalid = from > to;

  const href = useMemo(
    () =>
      `/api/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    [from, to],
  );

  async function onDownload() {
    setError(null);
    if (rangeInvalid) {
      setError("From date must be on or before To date.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(href);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          typeof body?.error === "string" ? body.error : "Export failed",
        );
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers
          .get("Content-Disposition")
          ?.match(/filename="([^"]+)"/)?.[1] ??
        `etc-attendance_${from}_to_${to}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="input-field"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">To</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="input-field"
          />
        </label>
      </div>
      {error || rangeInvalid ? (
        <p
          role="alert"
          className="rounded-lg bg-[var(--status-late-bg)] px-3 py-2 text-sm text-[var(--status-late-ink)]"
        >
          {error ?? "From date must be on or before To date."}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onDownload}
        disabled={busy || rangeInvalid}
        className="btn-primary"
      >
        {busy ? "Preparing…" : "Download Excel"}
      </button>
      <p className="text-sm text-muted">
        Sheets: General schedule, Tutors, Tutoree — same columns as your
        attendance template.
      </p>
    </div>
  );
}
