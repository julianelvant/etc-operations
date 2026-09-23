import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/session";
import { createWriteClient } from "@/lib/supabase/write";
import {
  createSnapshot,
  listSnapshots,
  restoreAttendanceSnapshot,
} from "@/lib/data/backups";

export async function GET() {
  try {
    await requireAdminSession();
    const supabase = await createWriteClient();
    const snapshots = await listSnapshots(supabase, 40);
    return NextResponse.json({ snapshots });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? "backup");
    const supabase = await createWriteClient();

    if (action === "backup") {
      const label = String(body.label ?? "manual").slice(0, 80);
      const result = await createSnapshot(supabase, {
        label,
        reason: "manual",
        createdBy: session.username,
      });
      return NextResponse.json({ ok: true, snapshot: result });
    }

    if (action === "restore") {
      const snapshotId = String(body.snapshotId ?? "");
      const confirm = String(body.confirm ?? "");
      if (!snapshotId) {
        return NextResponse.json(
          { error: "snapshotId required" },
          { status: 400 },
        );
      }
      if (confirm !== "RESTORE") {
        return NextResponse.json(
          { error: 'Type RESTORE to confirm replacing attendance data' },
          { status: 400 },
        );
      }
      const restored = await restoreAttendanceSnapshot(supabase, {
        snapshotId,
        actor: session.username,
      });
      return NextResponse.json({ ok: true, restored });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
