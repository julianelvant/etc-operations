import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseUrl,
  hasServiceRoleKey,
  requireEnv,
} from "./config";

/**
 * Server-only Supabase client with the service role key.
 * Bypasses RLS — use exclusively after cookie/session auth checks.
 * Never import this module from client components.
 */
export function createAdminClient(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient must only run on the server");
  }
  return createClient(
    getSupabaseUrl(),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

export function createAdminClientIfConfigured(): SupabaseClient | null {
  if (!hasServiceRoleKey()) return null;
  return createAdminClient();
}
