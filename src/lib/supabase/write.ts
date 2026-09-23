import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "./admin";
import { hasServiceRoleKey } from "./config";
import { createClient } from "./server";

/**
 * Privileged write client: service role when configured (bypasses RLS),
 * otherwise the cookie anon client which only has INSERT/UPDATE policies
 * (DELETE denied). Always pair with app session auth.
 */
export async function createWriteClient(): Promise<SupabaseClient> {
  if (hasServiceRoleKey()) {
    return createAdminClient();
  }
  return createClient();
}
