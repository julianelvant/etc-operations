import { createClient } from "@/lib/supabase/server";
import { createWriteClient } from "@/lib/supabase/write";
import type { SessionRole } from "@/lib/auth/session";
import {
  getAdminCredentials,
  getDeskCredentials,
} from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/passwords";
import { requireAudit } from "@/lib/data/backups";

export type StaffAccount = {
  id: string;
  username: string;
  display_name: string;
  role: SessionRole;
  active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type StaffAccountPublic = Omit<StaffAccount, never> & {
  /** Never expose hash to clients */
  has_password: true;
};

type StaffAccountRow = StaffAccount & { password_hash: string };

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function toPublic(row: StaffAccountRow): StaffAccount {
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    role: row.role,
    active: row.active,
    notes: row.notes ?? "",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Seed desk + admin from env when the table is empty. */
export async function ensureStaffAccountsSeeded(): Promise<void> {
  const supabase = await createWriteClient();
  const { count, error } = await supabase
    .from("staff_accounts")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  if ((count ?? 0) > 0) return;

  const desk = getDeskCredentials();
  const admin = getAdminCredentials();
  const rows: {
    username: string;
    display_name: string;
    password_hash: string;
    role: SessionRole;
    notes: string;
  }[] = [];

  if (desk.password) {
    rows.push({
      username: normalizeUsername(desk.username || "desk"),
      display_name: "Desk",
      password_hash: hashPassword(desk.password),
      role: "desk",
      notes: "Seeded from ATTENDANCE_* env",
    });
  }
  if (admin.username && admin.password) {
    rows.push({
      username: normalizeUsername(admin.username),
      display_name: "Admin",
      password_hash: hashPassword(admin.password),
      role: "admin",
      notes: "Seeded from ADMIN_* env",
    });
  }
  if (rows.length === 0) return;

  const { error: insertError } = await supabase
    .from("staff_accounts")
    .insert(rows);
  if (insertError) throw new Error(insertError.message);
}

export async function listStaffAccounts(): Promise<StaffAccount[]> {
  await ensureStaffAccountsSeeded();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_accounts")
    .select(
      "id, username, display_name, role, active, notes, created_at, updated_at, password_hash",
    )
    .order("role", { ascending: true })
    .order("username", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as StaffAccountRow[]).map(toPublic);
}

export async function authenticateStaff(
  username: string,
  password: string,
): Promise<{ username: string; displayName: string; role: SessionRole } | null> {
  await ensureStaffAccountsSeeded();
  const key = normalizeUsername(username);
  if (!key || !password) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_accounts")
    .select(
      "id, username, display_name, role, active, notes, created_at, updated_at, password_hash",
    )
    .eq("username", key)
    .maybeSingle();

  if (!error && data) {
    const row = data as StaffAccountRow;
    if (row.active && verifyPassword(password, row.password_hash)) {
      return {
        username: row.username,
        displayName: row.display_name || row.username,
        role: row.role === "admin" ? "admin" : "desk",
      };
    }
    // Wrong password for a known account — do not fall through to env
    // (avoids bypassing a rotated DB password with old env).
    if (row) return null;
  }

  // Env bootstrap fallback when username is not in DB yet
  const desk = getDeskCredentials();
  const admin = getAdminCredentials();
  if (
    desk.password &&
    key === normalizeUsername(desk.username) &&
    password === desk.password
  ) {
    return { username: desk.username, displayName: "Desk", role: "desk" };
  }
  if (
    admin.username &&
    admin.password &&
    key === normalizeUsername(admin.username) &&
    password === admin.password
  ) {
    return { username: admin.username, displayName: "Admin", role: "admin" };
  }
  return null;
}

export type UpsertStaffInput = {
  username: string;
  displayName: string;
  role: SessionRole;
  password?: string;
  active?: boolean;
  notes?: string;
};

export async function createStaffAccount(
  input: UpsertStaffInput,
): Promise<StaffAccount> {
  const username = normalizeUsername(input.username);
  if (!username) throw new Error("Username is required");
  if (!input.password || input.password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }
  if (input.role !== "desk" && input.role !== "admin") {
    throw new Error("Role must be desk or admin");
  }

  const supabase = await createWriteClient();
  const { data, error } = await supabase
    .from("staff_accounts")
    .insert({
      username,
      display_name: input.displayName.trim() || username,
      password_hash: hashPassword(input.password),
      role: input.role,
      active: input.active ?? true,
      notes: input.notes?.trim() ?? "",
    })
    .select(
      "id, username, display_name, role, active, notes, created_at, updated_at, password_hash",
    )
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("Username already exists");
    throw new Error(error.message);
  }
  await requireAudit(supabase, {
    actor: "admin",
    entity: "staff_accounts",
    entityId: data.id,
    action: "insert",
    after: toPublic(data as StaffAccountRow),
  });
  return toPublic(data as StaffAccountRow);
}

export async function updateStaffAccount(
  id: string,
  patch: {
    username?: string;
    displayName?: string;
    role?: SessionRole;
    password?: string;
    active?: boolean;
    notes?: string;
  },
): Promise<StaffAccount> {
  const supabase = await createWriteClient();

  if (patch.active === false || patch.role === "desk") {
    await assertNotLastActiveAdmin(id, patch);
  }

  const { data: before } = await supabase
    .from("staff_accounts")
    .select(
      "id, username, display_name, role, active, notes, created_at, updated_at, password_hash",
    )
    .eq("id", id)
    .maybeSingle();

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.username != null) {
    const u = normalizeUsername(patch.username);
    if (!u) throw new Error("Username is required");
    updates.username = u;
  }
  if (patch.displayName != null) {
    updates.display_name = patch.displayName.trim();
  }
  if (patch.role != null) {
    if (patch.role !== "desk" && patch.role !== "admin") {
      throw new Error("Role must be desk or admin");
    }
    updates.role = patch.role;
  }
  if (patch.active != null) updates.active = patch.active;
  if (patch.notes != null) updates.notes = patch.notes.trim();
  if (patch.password != null && patch.password !== "") {
    if (patch.password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }
    updates.password_hash = hashPassword(patch.password);
  }

  const { data, error } = await supabase
    .from("staff_accounts")
    .update(updates)
    .eq("id", id)
    .select(
      "id, username, display_name, role, active, notes, created_at, updated_at, password_hash",
    )
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("Username already exists");
    throw new Error(error.message);
  }
  await requireAudit(supabase, {
    actor: "admin",
    entity: "staff_accounts",
    entityId: id,
    action: patch.active === false ? "deactivate" : "update",
    before: before ? toPublic(before as StaffAccountRow) : null,
    after: toPublic(data as StaffAccountRow),
  });
  return toPublic(data as StaffAccountRow);
}

/** Soft-deactivate — hard DELETE is denied by RLS for anon. */
export async function deleteStaffAccount(id: string): Promise<void> {
  await updateStaffAccount(id, { active: false });
}

async function assertNotLastActiveAdmin(
  targetId: string,
  patch: { active?: boolean; role?: SessionRole },
): Promise<void> {
  const supabase = await createClient();
  const { data: target, error } = await supabase
    .from("staff_accounts")
    .select("id, role, active")
    .eq("id", targetId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!target) throw new Error("Account not found");

  const willBeAdmin =
    (patch.role ?? target.role) === "admin" &&
    (patch.active ?? target.active) === true;
  if (willBeAdmin) return;

  // Target is losing admin access — ensure another active admin remains
  if (target.role !== "admin" || !target.active) return;

  const { data: admins, error: listError } = await supabase
    .from("staff_accounts")
    .select("id")
    .eq("role", "admin")
    .eq("active", true);
  if (listError) throw new Error(listError.message);
  const others = (admins ?? []).filter((a) => a.id !== targetId);
  if (others.length === 0) {
    throw new Error("Cannot remove or demote the last active admin account");
  }
}
