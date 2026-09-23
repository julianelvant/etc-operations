"use client";

import { useCallback, useEffect, useState } from "react";
import {
  WEEKDAY_KEYS,
  type CalendarRecurringRow,
  type CalendarRecurringRole,
} from "@/lib/calendar-recurring";

const ROLE_OPTIONS: CalendarRecurringRole[] = [
  "Tutor",
  "TA",
  "Coordinator",
  "Other",
];

const DAY_LABELS: Record<string, string> = {
  sunday: "Sun",
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
};

const emptyForm = {
  display_name: "",
  role: "Tutor" as CalendarRecurringRole,
  days: ["monday", "tuesday", "wednesday", "thursday", "friday"] as string[],
  start_time: "12:00",
  end_time: "18:00",
  courses: "",
  notes: "",
};

function formatDays(days: string[]) {
  return days.map((d) => DAY_LABELS[d] ?? d).join(", ");
}

export function RecurringCalendarPanel() {
  const [entries, setEntries] = useState<CalendarRecurringRow[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/admin/calendar-recurring");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to load");
    setEntries(json.entries ?? []);
  }, []);

  useEffect(() => {
    void load().catch((e) =>
      setError(e instanceof Error ? e.message : "Failed to load"),
    );
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  function resetForm() {
    setForm(emptyForm);
    setEditId(null);
  }

  function startEdit(entry: CalendarRecurringRow) {
    setEditId(entry.id);
    setForm({
      display_name: entry.display_name,
      role: entry.role,
      days: [...entry.days],
      start_time: entry.start_time,
      end_time: entry.end_time,
      courses: entry.courses.join(", "),
      notes: entry.notes,
    });
  }

  function toggleDay(day: string) {
    setForm((f) => ({
      ...f,
      days: f.days.includes(day)
        ? f.days.filter((d) => d !== day)
        : [...f.days, day],
    }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = {
        ...form,
        courses: form.courses
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
      };
      const res = await fetch("/api/admin/calendar-recurring", {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editId ? { id: editId, ...payload } : payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setToast(editId ? "Recurring entry updated" : "Recurring entry added");
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDeactivate(id: string, name: string) {
    if (!window.confirm(`Deactivate recurring entry for ${name}?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/calendar-recurring", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Deactivate failed");
      setToast("Recurring entry deactivated");
      if (editId === id) resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deactivate failed");
    } finally {
      setBusy(false);
    }
  }

  const activeEntries = entries.filter((e) => e.active);
  const inactiveEntries = entries.filter((e) => !e.active);

  return (
    <section className="space-y-4" aria-labelledby="recurring-calendar-heading">
      <div>
        <h2
          id="recurring-calendar-heading"
          className="font-display text-lg font-semibold text-ink"
        >
          Recurring calendar
        </h2>
        <p className="mt-1 text-sm text-muted">
          People who appear every week on selected days — e.g. permanent desk
          TAs. Shown on the desk calendar alongside the semester schedule.
        </p>
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

      <form onSubmit={onSubmit} className="space-y-4 surface-panel p-5">
        <h3 className="text-sm font-semibold text-ink">
          {editId ? "Edit entry" : "Add recurring person"}
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-muted">Name</span>
            <input
              type="text"
              required
              value={form.display_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, display_name: e.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink focus-ring"
              placeholder="e.g. Alex Smith"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-muted">Role</span>
            <select
              value={form.role}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  role: e.target.value as CalendarRecurringRole,
                }))
              }
              className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink focus-ring"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>

          <div className="block sm:col-span-2">
            <span className="text-sm font-medium text-muted">Weekdays</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {WEEKDAY_KEYS.map((day) => {
                const on = form.days.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`min-h-9 rounded-lg px-3 text-sm font-medium focus-ring ${
                      on
                        ? "bg-brand text-white"
                        : "border border-border bg-surface text-muted"
                    }`}
                  >
                    {DAY_LABELS[day]}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-muted">Start</span>
            <input
              type="time"
              required
              value={form.start_time}
              onChange={(e) =>
                setForm((f) => ({ ...f, start_time: e.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink focus-ring"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-muted">End</span>
            <input
              type="time"
              required
              value={form.end_time}
              onChange={(e) =>
                setForm((f) => ({ ...f, end_time: e.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink focus-ring"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-muted">
              Courses (optional, comma-separated)
            </span>
            <input
              type="text"
              value={form.courses}
              onChange={(e) =>
                setForm((f) => ({ ...f, courses: e.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink focus-ring"
              placeholder="EECE 210, PHYS 210"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-muted">Notes (optional)</span>
            <input
              type="text"
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink focus-ring"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? "Saving…" : editId ? "Save changes" : "Add to calendar"}
          </button>
          {editId ? (
            <button
              type="button"
              onClick={resetForm}
              className="btn-secondary"
            >
              Cancel edit
            </button>
          ) : null}
        </div>
      </form>

      <div className="overflow-hidden surface-panel">
        <div className="border-b border-border px-5 py-3">
          <h3 className="text-sm font-semibold text-ink">Active entries</h3>
        </div>
        {activeEntries.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">No recurring entries yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {activeEntries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-ink">
                    {entry.display_name}
                    {entry.role !== "Tutor" ? (
                      <span className="ml-2 rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
                        {entry.role}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-sm text-muted">
                    {formatDays(entry.days)} · {entry.start_time}–{entry.end_time}
                  </p>
                  {entry.courses.length > 0 ? (
                    <p className="mt-0.5 text-xs text-muted">
                      {entry.courses.join(", ")}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(entry)}
                    className="btn-secondary min-h-9 px-3 text-xs"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeactivate(entry.id, entry.display_name)}
                    className="min-h-9 rounded-lg border border-border px-3 text-xs font-semibold text-muted hover:bg-bg focus-ring"
                  >
                    Deactivate
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {inactiveEntries.length > 0 ? (
        <details className="surface-panel">
          <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-muted">
            {inactiveEntries.length} deactivated
          </summary>
          <ul className="divide-y divide-border border-t border-border">
            {inactiveEntries.map((entry) => (
              <li key={entry.id} className="px-5 py-3 text-sm text-muted">
                {entry.display_name} · {formatDays(entry.days)}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
