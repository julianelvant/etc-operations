"use client";

import { useCallback, useEffect, useState } from "react";

type Snapshot = {
  id: string;
  created_at: string;
  label: string;
  reason: string;
  created_by: string;
  counts: Record<string, number>;
  storage_path: string | null;
};

type Health = {
  tutor_attendance?: number;
  student_visits?: number;
  tutors?: number;
  snapshots?: number;
  attendance_events?: number;
  last_backup_at?: string | null;
  service_role_configured?: boolean;
  anon_delete_blocked?: boolean;
};

function fmtWhen(iso: string | null | undefined) {
  if (!iso) return "Never";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Beirut",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function DataDurabilityPanel() {
  const [health, setHealth] = useState<Health | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");

  const load = useCallback(async () => {
    setError(null);
    const [hRes, sRes] = await Promise.all([
      fetch("/api/admin/health"),
      fetch("/api/admin/backups"),
    ]);
    const hJson = await hRes.json();
    const sJson = await sRes.json();
    if (!hRes.ok) throw new Error(hJson.error || "Health failed");
    if (!sRes.ok) throw new Error(sJson.error || "Backups failed");
    setHealth(hJson);
    setSnapshots(sJson.snapshots ?? []);
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

  async function onBackup() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "backup", label: "manual" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Backup failed");
      setToast(
        `Backup saved (${json.snapshot?.counts?.tutor_attendance ?? 0} attendance, ${json.snapshot?.counts?.student_visits ?? 0} visits)`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backup failed");
    } finally {
      setBusy(false);
    }
  }

  async function onRestore() {
    if (!restoreId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restore",
          snapshotId: restoreId,
          confirm,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Restore failed");
      setToast(
        `Restored ${json.restored?.tutor_attendance ?? 0} attendance, ${json.restored?.student_visits ?? 0} visits`,
      );
      setRestoreId(null);
      setConfirm("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 surface-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Data durability</h2>
          <p className="mt-1 text-sm text-muted">
            Snapshots are stored in the database (and mirrored to Storage when
            the service role key is configured). Restore replaces attendance
            and visits only.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onBackup()}
          className="btn-primary min-h-10"
        >
          {busy ? "Working…" : "Backup now"}
        </button>
      </div>

      {health ? (
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div>
            <dt className="text-muted">Attendance rows</dt>
            <dd className="font-semibold tabular-nums text-ink">
              {health.tutor_attendance ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Student visits</dt>
            <dd className="font-semibold tabular-nums text-ink">
              {health.student_visits ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Last backup</dt>
            <dd className="font-semibold text-ink">
              {fmtWhen(health.last_backup_at)}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Protection</dt>
            <dd className="font-semibold text-ink">
              {health.anon_delete_blocked
                ? "Anon delete blocked"
                : "Check RLS"}
              {health.service_role_configured ? " · service role" : ""}
            </dd>
          </div>
        </dl>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-lg bg-[var(--status-late-bg)] px-3 py-2 text-sm text-[var(--status-late-ink)]">
          {error}
        </p>
      ) : null}
      {toast ? (
        <p role="status" className="rounded-lg bg-[var(--status-here-bg)] px-3 py-2 text-sm text-[var(--status-here-ink)]">
          {toast}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-border">
        <div className="border-b border-border bg-bg px-4 py-2 text-sm font-medium text-ink">
          Snapshots ({snapshots.length})
        </div>
        {snapshots.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">No snapshots yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {snapshots.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink">
                    {s.label || "snapshot"}{" "}
                    <span className="font-normal text-muted">· {s.reason}</span>
                  </p>
                  <p className="text-muted">
                    {fmtWhen(s.created_at)} · by {s.created_by} ·{" "}
                    {Number(s.counts?.tutor_attendance ?? 0)} att /{" "}
                    {Number(s.counts?.student_visits ?? 0)} visits
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-secondary min-h-9 px-3 py-1.5"
                  onClick={() => {
                    setRestoreId(s.id);
                    setConfirm("");
                  }}
                >
                  Restore…
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {restoreId ? (
        <div className="rounded-lg border border-[var(--status-due-border)] bg-[var(--status-due-bg)] p-4">
          <p className="text-sm font-medium text-[var(--status-due-ink)]">
            Replace all attendance and visits from this snapshot?
          </p>
          <p className="mt-1 text-sm text-muted">
            Type <code className="rounded bg-surface px-1">RESTORE</code> to
            confirm. A pre-restore snapshot is taken automatically.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="input-field max-w-xs"
              placeholder="RESTORE"
              autoComplete="off"
            />
            <button
              type="button"
              disabled={busy || confirm !== "RESTORE"}
              onClick={() => void onRestore()}
              className="btn-primary min-h-10"
            >
              Confirm restore
            </button>
            <button
              type="button"
              className="btn-secondary min-h-10"
              onClick={() => {
                setRestoreId(null);
                setConfirm("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
