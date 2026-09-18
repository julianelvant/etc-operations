import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const checks = {
    app: "ok",
    supabase: "unknown" as "ok" | "error" | "unknown",
    timestamp: new Date().toISOString(),
  };

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.getSession();
    checks.supabase = error ? "error" : "ok";
  } catch {
    checks.supabase = "error";
  }

  const healthy = checks.app === "ok" && checks.supabase === "ok";

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "degraded",
      checks,
    },
    { status: healthy ? 200 : 503 },
  );
}
