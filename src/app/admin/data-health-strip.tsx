"use client";

import { useEffect, useState } from "react";

type Health = {
  tutor_attendance?: number;
  student_visits?: number;
  snapshots?: number;
  attendance_events?: number;
  last_backup_at?: string | null;
  anon_delete_blocked?: boolean;
  service_role_configured?: boolean;
};

function fmtWhen(iso: string | null | undefined) {
  if (!iso) return "no backup yet";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Beirut",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function DataHealthStrip() {
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/health")
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && !j.error) setHealth(j);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!health) return null;

  return (
    <div className="surface-panel flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm text-muted">
      <span className="font-medium text-ink">Data health</span>
      <span className="tabular-nums">
        {health.tutor_attendance ?? 0} attendance
      </span>
      <span className="tabular-nums">{health.student_visits ?? 0} visits</span>
      <span className="tabular-nums">{health.snapshots ?? 0} snapshots</span>
      <span>Last backup {fmtWhen(health.last_backup_at)}</span>
      <span>
        {health.anon_delete_blocked ? "Wipe-protected" : "RLS check needed"}
      </span>
      <a
        href="/desk/settings"
        className="font-semibold text-brand-ink underline focus-ring rounded"
      >
        Manage backups
      </a>
    </div>
  );
}
