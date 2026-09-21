import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { touchSessionHeartbeat } from "@/lib/auth/desk-sessions";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.sessionId) {
    return NextResponse.json({ ok: true, skipped: true });
  }
  try {
    await touchSessionHeartbeat(session.sessionId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Heartbeat failed" },
      { status: 500 },
    );
  }
}
