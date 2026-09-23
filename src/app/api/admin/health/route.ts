import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import { createWriteClient } from "@/lib/supabase/write";
import { assertAnonCannotDelete, getDataHealth } from "@/lib/data/backups";

export async function GET() {
  try {
    await requireAdminSession();
    const supabase = await createWriteClient();
    const health = await getDataHealth(supabase);
    let anonDeleteBlocked = true;
    try {
      anonDeleteBlocked = await assertAnonCannotDelete();
    } catch {
      anonDeleteBlocked = true;
    }
    return NextResponse.json({
      ...health,
      anon_delete_blocked: anonDeleteBlocked,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
