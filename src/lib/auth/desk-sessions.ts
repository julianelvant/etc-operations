import { createClient } from "@/lib/supabase/server";
import { createWriteClient } from "@/lib/supabase/write";
import type { SessionRole } from "@/lib/auth/session";

export type DeskSessionRow = {
  id: string;
  username: string;
  role: SessionRole;
  logged_in_at: string;
  last_seen_at: string;
  logged_out_at: string | null;
  user_agent: string | null;
};

/** Sessions seen within this window count as "active now". */
export const ACTIVE_SESSION_MS = 3 * 60 * 1000;

export async function recordSessionLogin(opts: {
  sessionId: string;
  username: string;
  role: SessionRole;
  userAgent?: string | null;
}) {
  const supabase = await createWriteClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("desk_sessions").upsert({
    id: opts.sessionId,
    username: opts.username,
    role: opts.role,
    logged_in_at: now,
    last_seen_at: now,
    logged_out_at: null,
    user_agent: opts.userAgent ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function recordSessionLogout(sessionId: string) {
  if (!sessionId) return;
  const supabase = await createWriteClient();
  const now = new Date().toISOString();
  await supabase
    .from("desk_sessions")
    .update({ logged_out_at: now, last_seen_at: now })
    .eq("id", sessionId)
    .is("logged_out_at", null);
}

export async function touchSessionHeartbeat(sessionId: string) {
  if (!sessionId) return;
  const supabase = await createWriteClient();
  const now = new Date().toISOString();
  await supabase
    .from("desk_sessions")
    .update({ last_seen_at: now })
    .eq("id", sessionId)
    .is("logged_out_at", null);
}

export async function listActiveSessions(): Promise<DeskSessionRow[]> {
  const supabase = await createClient();
  const cutoff = new Date(Date.now() - ACTIVE_SESSION_MS).toISOString();
  const { data, error } = await supabase
    .from("desk_sessions")
    .select(
      "id, username, role, logged_in_at, last_seen_at, logged_out_at, user_agent",
    )
    .is("logged_out_at", null)
    .gte("last_seen_at", cutoff)
    .order("last_seen_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DeskSessionRow[];
}

export async function listSessionHistory(
  limit = 40,
): Promise<DeskSessionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("desk_sessions")
    .select(
      "id, username, role, logged_in_at, last_seen_at, logged_out_at, user_agent",
    )
    .order("logged_in_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as DeskSessionRow[];
}
