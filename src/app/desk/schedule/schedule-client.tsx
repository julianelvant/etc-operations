"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CalendarRecurringRow } from "@/lib/calendar-recurring";
import type { ScheduleRosterRow } from "@/lib/schedule-roster";
import { slotLabel } from "@/lib/schedule";

const WEEKDAYS = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
] as const;

const DAY_SHORT: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
};

const ROLES = ["Tutor", "TA", "Coordinator", "Other"] as const;

type PersonForm = {
  id?: string;
  weekday: string;
  time_slot: string;
  person_name: string;
  courses: string;
  role: string;
};

const emptyPerson = (weekday = "monday", time_slot = "13:00-15:00"): PersonForm => ({
  weekday,
  time_slot,
  person_name: "",
  courses: "",
  role: "Tutor",
});

type RecurringForm = {
  id?: string;
  display_name: string;
  role: string;
  days: string[];
  start_time: string;
  end_time: string;
  courses: string;
  notes: string;
};

const emptyRecurring = (): RecurringForm => ({
  display_name: "",
  role: "Tutor",
  days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  start_time: "12:00",
  end_time: "18:00",
  courses: "",
  notes: "",
});

export function ScheduleClient() {
  const [title, setTitle] = useState("");
  const [entries, setEntries] = useState<ScheduleRosterRow[]>([]);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [recurring, setRecurring] = useState<CalendarRecurringRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [personForm, setPersonForm] = useState<PersonForm | null>(null);
  const [recurringForm, setRecurringForm] = useState<RecurringForm | null>(null);
  const [newSlot, setNewSlot] = useState("");

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/schedule");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to load schedule");
    setTitle(json.title ?? "Schedule");
    setEntries(json.entries ?? []);
    setTimeSlots(json.timeSlots ?? []);
    setRecurring(json.recurring ?? []);
  }, []);

  useEffect(() => {
    void load()
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load"),
      )
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const byCell = useMemo(() => {
    const map = new Map<string, ScheduleRosterRow[]>();
    for (const e of entries) {
      const key = `${e.weekday}|${e.time_slot}`;
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [entries]);

  const displaySlots = useMemo(() => {
    const set = new Set(timeSlots);
    for (const e of entries) set.add(e.time_slot);
    return Array.from(set).sort((a, b) => {
      const [aStart] = a.split("-");
      const [bStart] = b.split("-");
      return aStart.localeCompare(bStart) || a.localeCompare(b);
    });
  }, [timeSlots, entries]);

  async function savePerson(e: React.FormEvent) {
    e.preventDefault();
    if (!personForm) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        weekday: personForm.weekday,
        time_slot: personForm.time_slot,
        person_name: personForm.person_name,
        courses: personForm.courses,
        role: personForm.role,
      };
      const res = await fetch("/api/schedule", {
        method: personForm.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          personForm.id ? { id: personForm.id, ...payload } : payload,
        ),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setPersonForm(null);
      setToast(personForm.id ? "Updated" : "Added to schedule");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function removePerson(id: string, name: string) {
    if (!window.confirm(`Remove ${name} from the schedule?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/schedule?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Remove failed");
      setToast("Removed from schedule");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  }

  async function addTimeSlot() {
    const slot = newSlot.trim();
    if (!/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(slot)) {
      setError("Use format HH:MM-HH:MM (e.g. 13:00-15:00)");
      return;
    }
    if (displaySlots.includes(slot)) {
      setError("That time slot already exists");
      return;
    }
    setTimeSlots((prev) => [...prev, slot].sort());
    setNewSlot("");
    setToast("Time slot added — click + in a cell to assign someone");
  }

  async function saveRecurring(e: React.FormEvent) {
    e.preventDefault();
    if (!recurringForm) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        display_name: recurringForm.display_name,
        role: recurringForm.role,
        days: recurringForm.days,
        start_time: recurringForm.start_time,
        end_time: recurringForm.end_time,
        courses: recurringForm.courses,
        notes: recurringForm.notes,
      };
      const res = await fetch("/api/schedule/recurring", {
        method: recurringForm.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          recurringForm.id ? { id: recurringForm.id, ...payload } : payload,
        ),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setRecurringForm(null);
      setToast(recurringForm.id ? "Recurring entry updated" : "Recurring person added");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeRecurring(id: string, name: string) {
    if (!window.confirm(`Deactivate recurring entry for ${name}?`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/schedule/recurring", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Remove failed");
      setToast("Recurring entry removed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <p className="px-6 py-10 text-sm text-muted">Loading schedule…</p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold text-ink">
          {title}
        </h1>
        <p className="text-sm text-muted">
          Full weekly roster — add, edit, or remove anyone. Changes apply to the
          desk and Excel export immediately. Recurring people appear on the desk
          calendar every week.
        </p>
      </header>

      {error ? (
        <p className="rounded-lg bg-[var(--status-late-bg)] px-4 py-3 text-sm text-[var(--status-late-ink)]" role="alert">
          {error}
        </p>
      ) : null}
      {toast ? (
        <p className="rounded-lg bg-[var(--status-here-bg)] px-4 py-3 text-sm text-[var(--status-here-ink)]" role="status">
          {toast}
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="text-xs font-medium text-muted">New time slot</span>
          <input
            type="text"
            value={newSlot}
            onChange={(e) => setNewSlot(e.target.value)}
            placeholder="13:00-15:00"
            className="input-field mt-1 w-36"
          />
        </label>
        <button
          type="button"
          onClick={() => void addTimeSlot()}
          className="btn-secondary min-h-10"
        >
          Add row
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto surface-panel">
        <table className="w-full min-w-[56rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-slate-50">
              <th className="sticky left-0 z-10 bg-slate-50 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                Time
              </th>
              {WEEKDAYS.map((d) => (
                <th
                  key={d.key}
                  className="min-w-[10rem] px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted"
                >
                  {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displaySlots.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted"
                >
                  No time slots yet. Add a row above.
                </td>
              </tr>
            ) : (
              displaySlots.map((slot) => (
                <tr key={slot} className="border-b border-border align-top">
                  <td className="sticky left-0 z-10 bg-surface px-3 py-3 font-medium tabular-nums text-ink whitespace-nowrap">
                    {slotLabel(slot)}
                  </td>
                  {WEEKDAYS.map((d) => {
                    const cellKey = `${d.key}|${slot}`;
                    const people = byCell.get(cellKey) ?? [];
                    return (
                      <td key={cellKey} className="px-2 py-2 align-top">
                        <ul className="space-y-1.5">
                          {people.map((p) => (
                            <li
                              key={p.id}
                              className="group rounded-lg border border-border bg-bg px-2 py-1.5"
                            >
                              <div className="flex items-start justify-between gap-1">
                                <div className="min-w-0">
                                  <p className="font-semibold text-ink leading-tight">
                                    {p.person_name}
                                    {p.role !== "Tutor" ? (
                                      <span className="ml-1 text-[10px] font-semibold uppercase text-muted">
                                        {p.role}
                                      </span>
                                    ) : null}
                                  </p>
                                  {p.courses.length > 0 ? (
                                    <p className="mt-0.5 text-[11px] leading-snug text-muted">
                                      {p.courses.join(", ")}
                                    </p>
                                  ) : null}
                                </div>
                                <div className="flex shrink-0 gap-0.5 opacity-80 group-hover:opacity-100">
                                  <button
                                    type="button"
                                    title="Edit"
                                    onClick={() =>
                                      setPersonForm({
                                        id: p.id,
                                        weekday: p.weekday,
                                        time_slot: p.time_slot,
                                        person_name: p.person_name,
                                        courses: p.courses.join(", "),
                                        role: p.role,
                                      })
                                    }
                                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-brand-ink hover:bg-slate-100 focus-ring"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    title="Remove"
                                    onClick={() =>
                                      void removePerson(p.id, p.person_name)
                                    }
                                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-[var(--status-late-ink)] hover:bg-[var(--status-late-bg)] focus-ring"
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            setPersonForm(emptyPerson(d.key, slot))
                          }
                          className="mt-1.5 flex min-h-8 w-full items-center justify-center rounded-lg border border-dashed border-border text-xs font-semibold text-muted hover:border-brand hover:text-brand-ink focus-ring"
                        >
                          + Add
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">
              Recurring people
            </h2>
            <p className="mt-1 text-sm text-muted">
              Same person every week on selected days (e.g. permanent desk TAs).
              Shown on the desk calendar alongside the roster above.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRecurringForm(emptyRecurring())}
            className="btn-primary"
          >
            Add recurring person
          </button>
        </div>

        {recurring.length === 0 ? (
          <p className="text-sm text-muted">No recurring entries yet.</p>
        ) : (
          <ul className="divide-y divide-border surface-panel">
            {recurring.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div>
                  <p className="font-semibold text-ink">
                    {r.display_name}
                    {r.role !== "Tutor" ? (
                      <span className="ml-2 rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
                        {r.role}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-sm text-muted">
                    {r.days.map((d) => DAY_SHORT[d] ?? d).join(", ")} ·{" "}
                    {r.start_time}–{r.end_time}
                  </p>
                  {r.courses.length > 0 ? (
                    <p className="mt-0.5 text-xs text-muted">
                      {r.courses.join(", ")}
                    </p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setRecurringForm({
                        id: r.id,
                        display_name: r.display_name,
                        role: r.role,
                        days: [...r.days],
                        start_time: r.start_time,
                        end_time: r.end_time,
                        courses: r.courses.join(", "),
                        notes: r.notes,
                      })
                    }
                    className="btn-secondary min-h-9 px-3 text-xs"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeRecurring(r.id, r.display_name)}
                    className="btn-secondary min-h-9 px-3 text-xs"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {personForm ? (
        <Modal
          title={personForm.id ? "Edit person" : "Add to schedule"}
          onClose={() => setPersonForm(null)}
        >
          <form onSubmit={savePerson} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Day">
                <select
                  value={personForm.weekday}
                  onChange={(e) =>
                    setPersonForm((f) =>
                      f ? { ...f, weekday: e.target.value } : f,
                    )
                  }
                  className="input-field"
                >
                  {WEEKDAYS.map((d) => (
                    <option key={d.key} value={d.key}>{d.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Time slot">
                <input
                  required
                  value={personForm.time_slot}
                  onChange={(e) =>
                    setPersonForm((f) =>
                      f ? { ...f, time_slot: e.target.value } : f,
                    )
                  }
                  className="input-field"
                  placeholder="13:00-15:00"
                />
              </Field>
              <Field label="Name" className="sm:col-span-2">
                <input
                  required
                  value={personForm.person_name}
                  onChange={(e) =>
                    setPersonForm((f) =>
                      f ? { ...f, person_name: e.target.value } : f,
                    )
                  }
                  className="input-field"
                />
              </Field>
              <Field label="Role">
                <select
                  value={personForm.role}
                  onChange={(e) =>
                    setPersonForm((f) =>
                      f ? { ...f, role: e.target.value } : f,
                    )
                  }
                  className="input-field"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </Field>
              <Field label="Courses (comma-separated)" className="sm:col-span-2">
                <input
                  value={personForm.courses}
                  onChange={(e) =>
                    setPersonForm((f) =>
                      f ? { ...f, courses: e.target.value } : f,
                    )
                  }
                  className="input-field"
                  placeholder="EECE 210, PHYS 210"
                />
              </Field>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="btn-primary">
                {busy ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setPersonForm(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {recurringForm ? (
        <Modal
          title={recurringForm.id ? "Edit recurring person" : "Add recurring person"}
          onClose={() => setRecurringForm(null)}
        >
          <form onSubmit={saveRecurring} className="space-y-4">
            <Field label="Name">
              <input
                required
                value={recurringForm.display_name}
                onChange={(e) =>
                  setRecurringForm((f) =>
                    f ? { ...f, display_name: e.target.value } : f,
                  )
                }
                className="input-field"
              />
            </Field>
            <Field label="Role">
              <select
                value={recurringForm.role}
                onChange={(e) =>
                  setRecurringForm((f) =>
                    f ? { ...f, role: e.target.value } : f,
                  )
                }
                className="input-field"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </Field>
            <div>
              <span className="text-sm font-medium text-muted">Weekdays</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {WEEKDAYS.map((d) => {
                  const on = recurringForm.days.includes(d.key);
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() =>
                        setRecurringForm((f) =>
                          f
                            ? {
                                ...f,
                                days: on
                                  ? f.days.filter((x) => x !== d.key)
                                  : [...f.days, d.key],
                              }
                            : f,
                        )
                      }
                      className={`min-h-9 rounded-lg px-3 text-sm font-medium focus-ring ${
                        on
                          ? "bg-brand text-white"
                          : "border border-border bg-surface text-muted"
                      }`}
                    >
                      {DAY_SHORT[d.key]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Start">
                <input
                  type="time"
                  required
                  value={recurringForm.start_time}
                  onChange={(e) =>
                    setRecurringForm((f) =>
                      f ? { ...f, start_time: e.target.value } : f,
                    )
                  }
                  className="input-field"
                />
              </Field>
              <Field label="End">
                <input
                  type="time"
                  required
                  value={recurringForm.end_time}
                  onChange={(e) =>
                    setRecurringForm((f) =>
                      f ? { ...f, end_time: e.target.value } : f,
                    )
                  }
                  className="input-field"
                />
              </Field>
            </div>
            <Field label="Courses">
              <input
                value={recurringForm.courses}
                onChange={(e) =>
                  setRecurringForm((f) =>
                    f ? { ...f, courses: e.target.value } : f,
                  )
                }
                className="input-field"
              />
            </Field>
            <Field label="Notes">
              <input
                value={recurringForm.notes}
                onChange={(e) =>
                  setRecurringForm((f) =>
                    f ? { ...f, notes: e.target.value } : f,
                  )
                }
                className="input-field"
              />
            </Field>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="btn-primary">
                {busy ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setRecurringForm(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto surface-panel p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 id="schedule-modal-title" className="text-lg font-semibold text-ink">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-muted hover:bg-bg focus-ring"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-medium text-muted">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
