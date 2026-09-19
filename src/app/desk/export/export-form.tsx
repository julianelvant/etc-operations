"use client";

import { useMemo, useState } from "react";

export function ExportForm({ today }: { today: string }) {
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  const href = useMemo(
    () => `/api/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    [from, to],
  );

  return (
    <div className="mt-8 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            From
          </span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            To
          </span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </label>
      </div>
      <a
        href={href}
        className="inline-flex rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
      >
        Download Excel
      </a>
      <p className="text-sm text-slate-500">
        Sheets: General schedule, Tutors, Tutoree — same columns as your
        attendance template.
      </p>
    </div>
  );
}
