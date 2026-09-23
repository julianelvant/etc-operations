import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import { createWriteClient } from "@/lib/supabase/write";
import { createSnapshot, requireAudit } from "@/lib/data/backups";
import { importAttendanceFromTemplate } from "@/lib/excel-import";

export async function POST() {
  try {
    const session = await requireAdminSession();
    const supabase = await createWriteClient();

    await createSnapshot(supabase, {
      label: "pre-import",
      reason: "pre-import",
      createdBy: session.username,
    });

    const summary = await importAttendanceFromTemplate(
      supabase,
      session.username,
    );

    await requireAudit(supabase, {
      actor: session.username,
      entity: "system",
      action: "import",
      after: summary,
    });

    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Import failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
