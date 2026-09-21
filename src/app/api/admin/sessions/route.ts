import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  listActiveSessions,
  listSessionHistory,
} from "@/lib/auth/desk-sessions";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [active, history] = await Promise.all([
      listActiveSessions(),
      listSessionHistory(50),
    ]);
    return NextResponse.json({ active, history });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load sessions" },
      { status: 500 },
    );
  }
}
