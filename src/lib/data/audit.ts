import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditEntity =
  | "tutor_attendance"
  | "student_visits"
  | "tutors"
  | "staff_accounts"
  | "desk_sessions"
  | "system";

export type AuditAction =
  | "insert"
  | "update"
  | "checkout"
  | "set_times"
  | "import"
  | "restore"
  | "wipe"
  | "backup"
  | "deactivate";

export async function logAttendanceEvent(
  supabase: SupabaseClient,
  opts: {
    actor: string;
    entity: AuditEntity;
    entityId?: string;
    action: AuditAction;
    before?: unknown;
    after?: unknown;
  },
): Promise<void> {
  const { error } = await supabase.rpc("log_attendance_event", {
    p_actor: opts.actor,
    p_entity: opts.entity,
    p_entity_id: opts.entityId ?? "",
    p_action: opts.action,
    p_before: opts.before ?? null,
    p_after: opts.after ?? null,
  });
  if (error) {
    throw new Error(`Audit log failed: ${error.message}`);
  }
}
