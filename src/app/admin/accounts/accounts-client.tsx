"use client";

import { useCallback, useEffect, useState } from "react";
import type { SessionRole } from "@/lib/auth/session";
import type { StaffAccount } from "@/lib/auth/staff-accounts";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/25";

const emptyForm = {
  username: "",
  displayName: "",
  role: "desk" as SessionRole,
  password: "",
  notes: "",
};

export function AccountsClient() {
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({
    username: "",
    displayName: "",
    role: "desk" as SessionRole,
    password: "",
    notes: "",
    active: true,
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/accounts");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load accounts");
      setAccounts(data.accounts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      setForm(emptyForm);
      setToast(`Created ${data.account.username}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(a: StaffAccount) {
    setEditingId(a.id);
    setEdit({
      username: a.username,
      displayName: a.display_name,
      role: a.role,
      password: "",
      notes: a.notes ?? "",
      active: a.active,
    });
  }

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          username: edit.username,
          displayName: edit.displayName,
          role: edit.role,
          password: edit.password || undefined,
          notes: edit.notes,
          active: edit.active,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setEditingId(null);
      setToast(`Updated ${data.account.username}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(a: StaffAccount) {
    if (
      !window.confirm(
        `Delete account “${a.username}”? They will no longer be able to sign in.`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/accounts?id=${encodeURIComponent(a.id)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setToast(`Deleted ${a.username}`);
      if (editingId === a.id) setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800/70">
          Access
        </p>
        <h1 className="font-display text-3xl font-semibold text-slate-900">
          Staff accounts
        </h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Create and manage desk and admin logins — display name, username,
          password, role, and notes. Changes apply on the next sign-in.
        </p>
      </header>

      {error ? (
        <p
          className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {toast ? (
        <p
          className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          role="status"
        >
          {toast}
        </p>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-slate-900">
          Add account
        </h2>
        <form
          onSubmit={onCreate}
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          <Field label="Display name">
            <input
              required
              value={form.displayName}
              onChange={(e) =>
                setForm((f) => ({ ...f, displayName: e.target.value }))
              }
              className={inputClass}
              placeholder="Front desk"
            />
          </Field>
          <Field label="Username">
            <input
              required
              autoComplete="off"
              value={form.username}
              onChange={(e) =>
                setForm((f) => ({ ...f, username: e.target.value }))
              }
              className={inputClass}
              placeholder="desk2"
            />
          </Field>
          <Field label="Password">
            <input
              required
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value }))
              }
              className={inputClass}
              placeholder="At least 6 characters"
            />
          </Field>
          <Field label="Role">
            <select
              value={form.role}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  role: e.target.value as SessionRole,
                }))
              }
              className={inputClass}
            >
              <option value="desk">Desk</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <input
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              className={inputClass}
              placeholder="Optional"
            />
          </Field>
          <div className="flex items-end sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              disabled={creating}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
            >
              {creating ? "Creating…" : "Create account"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            All accounts
          </h2>
          <p className="text-sm tabular-nums text-slate-500">
            {accounts.length} total
          </p>
        </div>

        {loading ? (
          <p className="px-5 py-8 text-sm text-slate-500">Loading…</p>
        ) : accounts.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">No accounts yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {accounts.map((a) => (
              <li key={a.id} className="px-5 py-4">
                {editingId === a.id ? (
                  <form
                    onSubmit={onSaveEdit}
                    className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                  >
                    <Field label="Display name">
                      <input
                        required
                        value={edit.displayName}
                        onChange={(e) =>
                          setEdit((x) => ({
                            ...x,
                            displayName: e.target.value,
                          }))
                        }
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Username">
                      <input
                        required
                        value={edit.username}
                        onChange={(e) =>
                          setEdit((x) => ({ ...x, username: e.target.value }))
                        }
                        className={inputClass}
                      />
                    </Field>
                    <Field label="New password (optional)">
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={edit.password}
                        onChange={(e) =>
                          setEdit((x) => ({ ...x, password: e.target.value }))
                        }
                        className={inputClass}
                        placeholder="Leave blank to keep"
                      />
                    </Field>
                    <Field label="Role">
                      <select
                        value={edit.role}
                        onChange={(e) =>
                          setEdit((x) => ({
                            ...x,
                            role: e.target.value as SessionRole,
                          }))
                        }
                        className={inputClass}
                      >
                        <option value="desk">Desk</option>
                        <option value="admin">Admin</option>
                      </select>
                    </Field>
                    <Field label="Status">
                      <select
                        value={edit.active ? "active" : "inactive"}
                        onChange={(e) =>
                          setEdit((x) => ({
                            ...x,
                            active: e.target.value === "active",
                          }))
                        }
                        className={inputClass}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </Field>
                    <Field label="Notes">
                      <input
                        value={edit.notes}
                        onChange={(e) =>
                          setEdit((x) => ({ ...x, notes: e.target.value }))
                        }
                        className={inputClass}
                      />
                    </Field>
                    <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
                      <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex min-h-10 items-center rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                      >
                        {saving ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="inline-flex min-h-10 items-center rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">
                        {a.display_name || a.username}
                        <span className="ml-2 font-normal text-slate-500">
                          @{a.username}
                        </span>
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                        <RoleBadge role={a.role} />
                        <StatusBadge active={a.active} />
                        {a.notes ? <span>· {a.notes}</span> : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(a)}
                        className="inline-flex min-h-10 items-center rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDelete(a)}
                        className="inline-flex min-h-10 items-center rounded-full border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-800 hover:bg-rose-100"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
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
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function RoleBadge({ role }: { role: SessionRole }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
        role === "admin"
          ? "bg-violet-100 text-violet-900"
          : "bg-sky-100 text-sky-900"
      }`}
    >
      {role}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
        active
          ? "bg-emerald-100 text-emerald-900"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      {active ? "active" : "inactive"}
    </span>
  );
}
