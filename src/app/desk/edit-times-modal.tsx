"use client";

import { useEffect, useState } from "react";
import type { TutorAttendanceRow } from "@/lib/attendance";
import { TIMEZONE } from "@/lib/schedule";

/** Convert ISO → value for datetime-local in Asia/Beirut wall clock. */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  );
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}

/** datetime-local (Beirut wall) → ISO assuming Asia/Beirut offset for that instant. */
function fromLocalInput(local: string): string {
  // Interpret as Beirut local by appending offset via Temporal-less approach:
  // Build a date string and use a formatter round-trip.
  const m = local.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/,
  );
  if (!m) throw new Error("Invalid datetime");
  const [, y, mo, d, h, mi] = m;
  // Guess UTC then refine: try UTC and adjust by observed Beirut offset
  let guess = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  for (let i = 0; i < 3; i++) {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = Object.fromEntries(
      fmt.formatToParts(new Date(guess)).map((p) => [p.type, p.value]),
    );
    const hour = parts.hour === "24" ? "00" : parts.hour;
    const got = `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
    if (got === local) break;
    const gotMs = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(hour),
      Number(parts.minute),
    );
    guess += Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi)) - gotMs;
  }
  return new Date(guess).toISOString();
}

type Props = {
  row: TutorAttendanceRow | null;
  pending: boolean;
  onClose: () => void;
  onSave: (patch: {
    id: string;
    timeIn: string;
    timeOut: string | null;
    scheduledShift: string;
  }) => void | Promise<void>;
};

export function EditTimesModal({ row, pending, onClose, onSave }: Props) {
  const [timeIn, setTimeIn] = useState("");
  const [timeOut, setTimeOut] = useState("");
  const [stillOpen, setStillOpen] = useState(false);
  const [shift, setShift] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!row) return;
    setTimeIn(toLocalInput(row.time_in));
    setTimeOut(row.time_out ? toLocalInput(row.time_out) : "");
    setStillOpen(!row.time_out);
    setShift(row.scheduled_shift ?? "");
    setError(null);
  }, [row]);

  if (!row) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-times-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="edit-times-title"
          className="font-display text-xl font-semibold text-slate-900"
        >
          Edit times
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {row.tutors?.name ?? "Tutor"} — fix a missed check-out or wrong times.
        </p>

        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            try {
              const tin = fromLocalInput(timeIn);
              const tout = stillOpen || !timeOut ? null : fromLocalInput(timeOut);
              void Promise.resolve(
                onSave({
                  id: row.id,
                  timeIn: tin,
                  timeOut: tout,
                  scheduledShift: shift,
                }),
              ).catch((err) => {
                setError(err instanceof Error ? err.message : "Save failed");
              });
            } catch (err) {
              setError(err instanceof Error ? err.message : "Invalid times");
            }
          }}
        >
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Check in
            </span>
            <input
              type="datetime-local"
              required
              value={timeIn}
              onChange={(e) => setTimeIn(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/25"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={stillOpen}
              onChange={(e) => setStillOpen(e.target.checked)}
              className="rounded border-slate-300"
            />
            Still checked in (no check-out)
          </label>
          {!stillOpen ? (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Check out
              </span>
              <input
                type="datetime-local"
                required={!stillOpen}
                value={timeOut}
                onChange={(e) => setTimeOut(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/25"
              />
            </label>
          ) : null}
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Scheduled shift
            </span>
            <input
              value={shift}
              onChange={(e) => setShift(e.target.value)}
              placeholder="13:00-15:00"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/25"
            />
          </label>
          {error ? (
            <p className="text-sm text-rose-700" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-10 items-center rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-10 items-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
