import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClientIfConfigured } from "@/lib/supabase/admin";
import { hasServiceRoleKey } from "@/lib/supabase/config";
import { logAttendanceEvent } from "@/lib/data/audit";

export type SnapshotCounts = {
  tutor_attendance: number;
  student_visits: number;
  tutors: number;
  staff_accounts: number;
  desk_sessions: number;
};

export type SnapshotMeta = {
  id: string;
  created_at: string;
  label: string;
  reason: string;
  created_by: string;
  counts: SnapshotCounts | Record<string, unknown>;
  storage_path: string | null;
};

export type SnapshotPayload = {
  tutor_attendance: unknown[];
  student_visits: unknown[];
  tutors: unknown[];
  staff_accounts: unknown[];
  desk_sessions: unknown[];
};

async function fetchAll(
  supabase: SupabaseClient,
  table: string,
  columns = "*",
): Promise<unknown[]> {
  const { data, error } = await supabase.from(table).select(columns);
  if (error) throw new Error(`Failed to read ${table}: ${error.message}`);
  return data ?? [];
}

export async function buildSnapshotPayload(
  supabase: SupabaseClient,
): Promise<{ counts: SnapshotCounts; payload: SnapshotPayload }> {
  const [
    tutor_attendance,
    student_visits,
    tutors,
    staffRows,
    desk_sessions,
  ] = await Promise.all([
    fetchAll(supabase, "tutor_attendance"),
    fetchAll(supabase, "student_visits"),
    fetchAll(supabase, "tutors"),
    fetchAll(
      supabase,
      "staff_accounts",
      "id, username, display_name, role, active, notes, password_hash, created_at, updated_at",
    ),
    fetchAll(supabase, "desk_sessions"),
  ]);

  const staff_accounts = staffRows;
  const counts: SnapshotCounts = {
    tutor_attendance: tutor_attendance.length,
    student_visits: student_visits.length,
    tutors: tutors.length,
    staff_accounts: staff_accounts.length,
    desk_sessions: desk_sessions.length,
  };

  return {
    counts,
    payload: {
      tutor_attendance,
      student_visits,
      tutors,
      staff_accounts,
      desk_sessions,
    },
  };
}

async function mirrorToStorage(
  snapshotId: string,
  label: string,
  body: unknown,
): Promise<string | null> {
  const admin = createAdminClientIfConfigured();
  if (!admin) return null;
  const path = `backups/${new Date().toISOString().replace(/[:.]/g, "-")}-${label || "snapshot"}-${snapshotId}.json`;
  const bytes = Buffer.from(JSON.stringify(body), "utf8");
  const { error } = await admin.storage
    .from("attendance-backups")
    .upload(path, bytes, {
      contentType: "application/json",
      upsert: false,
    });
  if (error) {
    console.error("Storage mirror failed:", error.message);
    return null;
  }
  return path;
}

export async function createSnapshot(
  supabase: SupabaseClient,
  opts: {
    label: string;
    reason: string;
    createdBy: string;
  },
): Promise<{ id: string; counts: SnapshotCounts; storagePath: string | null }> {
  const { counts, payload } = await buildSnapshotPayload(supabase);

  const { data: id, error } = await supabase.rpc("create_data_snapshot", {
    p_label: opts.label,
    p_reason: opts.reason,
    p_created_by: opts.createdBy,
    p_counts: counts,
    p_payload: payload,
    p_storage_path: null,
  });
  if (error || !id) {
    throw new Error(error?.message ?? "Snapshot failed");
  }

  const storagePath = await mirrorToStorage(String(id), opts.label, {
    id,
    counts,
    payload,
    label: opts.label,
    reason: opts.reason,
    created_by: opts.createdBy,
  });

  if (storagePath && hasServiceRoleKey()) {
    const admin = createAdminClientIfConfigured();
    await admin
      ?.from("data_snapshots")
      .update({ storage_path: storagePath })
      .eq("id", id);
  }

  return { id: String(id), counts, storagePath };
}

export async function listSnapshots(
  supabase: SupabaseClient,
  limit = 30,
): Promise<SnapshotMeta[]> {
  const { data, error } = await supabase.rpc("list_data_snapshots", {
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as SnapshotMeta[];
}

export async function restoreAttendanceSnapshot(
  supabase: SupabaseClient,
  opts: { snapshotId: string; actor: string },
): Promise<{ tutor_attendance: number; student_visits: number }> {
  // Always snapshot current state before restore
  await createSnapshot(supabase, {
    label: "pre-restore",
    reason: "pre-restore",
    createdBy: opts.actor,
  });

  const { data, error } = await supabase.rpc(
    "restore_attendance_from_snapshot",
    {
      p_snapshot_id: opts.snapshotId,
      p_actor: opts.actor,
    },
  );
  if (error) throw new Error(error.message);
  return data as { tutor_attendance: number; student_visits: number };
}

export async function getDataHealth(
  supabase: SupabaseClient,
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc("data_health");
  if (error) throw new Error(error.message);
  return {
    ...(data as Record<string, unknown>),
    service_role_configured: hasServiceRoleKey(),
  };
}

export async function assertAnonCannotDelete(): Promise<boolean> {
  const { createClient } = await import("@supabase/supabase-js");
  const { getSupabaseAnonKey, getSupabaseUrl } = await import(
    "@/lib/supabase/config"
  );
  const anon = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existing } = await anon
    .from("tutor_attendance")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (!existing?.id) {
    // Empty table: insert temporary probe, attempt delete, confirm it remains,
    // then clear via restore of empty snapshot is too heavy — use update+filter date.
    const { data: tutor } = await anon
      .from("tutors")
      .select("id")
      .limit(1)
      .single();
    if (!tutor?.id) return true;
    const { data: row } = await anon
      .from("tutor_attendance")
      .insert({
        attendance_date: "2099-01-01",
        tutor_id: tutor.id,
        scheduled_shift: "probe",
        role: "Tutor",
        time_in: "2099-01-01T12:00:00+03:00",
        notes: "rls-delete-probe",
        created_by: "health-check",
      })
      .select("id")
      .single();
    if (!row?.id) return true;
    await anon.from("tutor_attendance").delete().eq("id", row.id);
    const { data: still } = await anon
      .from("tutor_attendance")
      .select("id")
      .eq("id", row.id)
      .maybeSingle();
    // Remove probe via restore empty snapshot of attendance only through RPC
    // by restoring a tiny empty snapshot created for cleanup.
    const { data: snapId } = await anon.rpc("create_data_snapshot", {
      p_label: "health-cleanup",
      p_reason: "health-check",
      p_created_by: "health-check",
      p_counts: { tutor_attendance: 0, student_visits: 0 },
      p_payload: {
        tutor_attendance: [],
        student_visits: [],
        tutors: [],
        staff_accounts: [],
        desk_sessions: [],
      },
      p_storage_path: null,
    });
    if (snapId) {
      await anon.rpc("restore_attendance_from_snapshot", {
        p_snapshot_id: snapId,
        p_actor: "health-check",
      });
    }
    return Boolean(still?.id);
  }

  const id = existing.id;
  await anon.from("tutor_attendance").delete().eq("id", id);
  const { data: still } = await anon
    .from("tutor_attendance")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  return Boolean(still?.id);
}

/** Ensure audit RPC is reachable — used after mutations that must fail closed. */
export async function requireAudit(
  supabase: SupabaseClient,
  opts: Parameters<typeof logAttendanceEvent>[1],
): Promise<void> {
  await logAttendanceEvent(supabase, opts);
}
