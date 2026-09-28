import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  createCalendarRecurring,
  deactivateCalendarRecurring,
  listCalendarRecurring,
  updateCalendarRecurring,
  WEEKDAY_KEYS,
  type CalendarRecurringRole,
} from "@/lib/calendar-recurring";
import { logAttendanceEvent } from "@/lib/data/audit";
import { ensureTutorForPerson } from "@/lib/tutor-sync";
import { createWriteClient } from "@/lib/supabase/write";

const ROLES: CalendarRecurringRole[] = [
  "Tutor",
  "TA",
  "Coordinator",
  "Other",
];

function parseRole(value: unknown): CalendarRecurringRole {
  const role = String(value ?? "Tutor").trim();
  return ROLES.includes(role as CalendarRecurringRole)
    ? (role as CalendarRecurringRole)
    : "Tutor";
}

function parseDays(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(WEEKDAY_KEYS);
  return value
    .map((d) => String(d).toLowerCase())
    .filter((d) => allowed.has(d as (typeof WEEKDAY_KEYS)[number]));
}

function parseCourses(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
  }
  if (!Array.isArray(value)) return [];
  return value.map((c) => String(c).trim()).filter(Boolean);
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const supabase = await createWriteClient();
    const entries = await listCalendarRecurring(supabase, { activeOnly: true });
    return NextResponse.json({ entries });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const display_name = String(body.display_name ?? "").trim();
    const days = parseDays(body.days);
    const start_time = String(body.start_time ?? "").slice(0, 5);
    const end_time = String(body.end_time ?? "").slice(0, 5);
    const courses = parseCourses(body.courses);

    if (!display_name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (days.length === 0) {
      return NextResponse.json(
        { error: "Select at least one weekday" },
        { status: 400 },
      );
    }
    if (!/^\d{2}:\d{2}$/.test(start_time) || !/^\d{2}:\d{2}$/.test(end_time)) {
      return NextResponse.json(
        { error: "Start and end time required (HH:MM)" },
        { status: 400 },
      );
    }
    if (start_time >= end_time) {
      return NextResponse.json(
        { error: "End time must be after start time" },
        { status: 400 },
      );
    }

    const supabase = await createWriteClient();
    const entry = await createCalendarRecurring(supabase, {
      display_name,
      role: parseRole(body.role),
      days,
      start_time,
      end_time,
      courses,
      notes: String(body.notes ?? "").trim(),
    });

    await ensureTutorForPerson(supabase, display_name, courses);

    await logAttendanceEvent(supabase, {
      actor: session.username,
      entity: "system",
      entityId: entry.id,
      action: "insert",
      after: entry,
    });

    return NextResponse.json({ ok: true, entry });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const id = String(body.id ?? "");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const patch: Record<string, unknown> = {};
    if (body.display_name !== undefined) {
      patch.display_name = String(body.display_name).trim();
    }
    if (body.role !== undefined) patch.role = parseRole(body.role);
    if (body.days !== undefined) patch.days = parseDays(body.days);
    if (body.start_time !== undefined) {
      patch.start_time = String(body.start_time).slice(0, 5);
    }
    if (body.end_time !== undefined) {
      patch.end_time = String(body.end_time).slice(0, 5);
    }
    if (body.courses !== undefined) patch.courses = parseCourses(body.courses);
    if (body.notes !== undefined) patch.notes = String(body.notes).trim();

    const supabase = await createWriteClient();
    const before = (await listCalendarRecurring(supabase)).find((e) => e.id === id);
    const entry = await updateCalendarRecurring(supabase, id, patch);

    const name = String(patch.display_name ?? entry.display_name);
    const courses = (patch.courses as string[] | undefined) ?? entry.courses;
    await ensureTutorForPerson(supabase, name, courses);

    await logAttendanceEvent(supabase, {
      actor: session.username,
      entity: "system",
      entityId: entry.id,
      action: "update",
      before,
      after: entry,
    });

    return NextResponse.json({ ok: true, entry });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const id = String(body.id ?? "");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const supabase = await createWriteClient();
    const before = (await listCalendarRecurring(supabase)).find((e) => e.id === id);
    const entry = await deactivateCalendarRecurring(supabase, id);

    await logAttendanceEvent(supabase, {
      actor: session.username,
      entity: "system",
      entityId: entry.id,
      action: "deactivate",
      before,
      after: entry,
    });

    return NextResponse.json({ ok: true, entry });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}
