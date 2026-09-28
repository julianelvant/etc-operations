import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  createScheduleRosterEntry,
  deleteScheduleRosterEntry,
  ensureScheduleRosterSeeded,
  listScheduleRoster,
  loadScheduleDays,
  renamePersonOnRoster,
  rosterToSlots,
  collectTimeSlots,
  updateScheduleRosterEntry,
  type ScheduleRosterRole,
} from "@/lib/schedule-roster";
import {
  listCalendarRecurring,
  renamePersonInRecurring,
} from "@/lib/calendar-recurring";
import { schedule } from "@/lib/schedule";
import { logAttendanceEvent } from "@/lib/data/audit";
import {
  deactivateTutorIfOffSchedule,
  ensureTutorForPerson,
  renameTutorByName,
} from "@/lib/tutor-sync";
import { createWriteClient } from "@/lib/supabase/write";

const ROLES: ScheduleRosterRole[] = ["Tutor", "TA", "Coordinator", "Other"];
const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"];

function parseRole(value: unknown): ScheduleRosterRole {
  const role = String(value ?? "Tutor").trim();
  return ROLES.includes(role as ScheduleRosterRole)
    ? (role as ScheduleRosterRole)
    : "Tutor";
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
    await ensureScheduleRosterSeeded(supabase);
    const [rows, recurring] = await Promise.all([
      listScheduleRoster(supabase, { activeOnly: true }),
      listCalendarRecurring(supabase, { activeOnly: true }),
    ]);
    const days = rosterToSlots(rows);
    const timeSlots = collectTimeSlots(days);

    return NextResponse.json({
      title: schedule.title,
      timezone: schedule.timezone,
      days,
      timeSlots,
      entries: rows,
      recurring,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load schedule" },
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
    const weekday = String(body.weekday ?? "").toLowerCase();
    const time_slot = String(body.time_slot ?? "").trim();
    const person_name = String(body.person_name ?? "").trim();

    if (!WEEKDAYS.includes(weekday)) {
      return NextResponse.json({ error: "Invalid weekday" }, { status: 400 });
    }
    if (!time_slot || !/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(time_slot)) {
      return NextResponse.json(
        { error: "Time slot required (e.g. 13:00-15:00)" },
        { status: 400 },
      );
    }
    if (!person_name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const supabase = await createWriteClient();
    const courses = parseCourses(body.courses);
    const entry = await createScheduleRosterEntry(supabase, {
      weekday,
      time_slot,
      person_name,
      courses,
      role: parseRole(body.role),
    });

    await ensureTutorForPerson(supabase, person_name, courses);

    await logAttendanceEvent(supabase, {
      actor: session.username,
      entity: "system",
      entityId: entry.id,
      action: "insert",
      after: entry,
    });

    const days = await loadScheduleDays(supabase);
    return NextResponse.json({ ok: true, entry, days });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to add" },
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
    if (body.weekday !== undefined) {
      const weekday = String(body.weekday).toLowerCase();
      if (!WEEKDAYS.includes(weekday)) {
        return NextResponse.json({ error: "Invalid weekday" }, { status: 400 });
      }
      patch.weekday = weekday;
    }
    if (body.time_slot !== undefined) {
      patch.time_slot = String(body.time_slot).trim();
    }
    if (body.person_name !== undefined) {
      patch.person_name = String(body.person_name).trim();
    }
    if (body.courses !== undefined) patch.courses = parseCourses(body.courses);
    if (body.role !== undefined) patch.role = parseRole(body.role);

    const supabase = await createWriteClient();
    const before = (await listScheduleRoster(supabase, { activeOnly: true })).find(
      (row) => row.id === id,
    );
    if (!before) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    if (
      patch.person_name &&
      String(patch.person_name).trim().toLowerCase() !==
        before.person_name.toLowerCase()
    ) {
      const newName = String(patch.person_name).trim();
      await renamePersonOnRoster(supabase, before.person_name, newName);
      await renamePersonInRecurring(supabase, before.person_name, newName);
      await renameTutorByName(supabase, before.person_name, newName);
    }

    const entry = await updateScheduleRosterEntry(supabase, id, patch);

    await ensureTutorForPerson(supabase, entry.person_name, entry.courses);

    await logAttendanceEvent(supabase, {
      actor: session.username,
      entity: "system",
      entityId: entry.id,
      action: "update",
      after: entry,
    });

    const days = await loadScheduleDays(supabase);
    return NextResponse.json({ ok: true, entry, days });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update" },
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

    const url = new URL(request.url);
    const id = String(url.searchParams.get("id") ?? "");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const supabase = await createWriteClient();
    const before = (await listScheduleRoster(supabase, { activeOnly: true })).find(
      (row) => row.id === id,
    );
    if (!before) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    await deleteScheduleRosterEntry(supabase, id);
    await deactivateTutorIfOffSchedule(supabase, before.person_name);

    await logAttendanceEvent(supabase, {
      actor: session.username,
      entity: "system",
      entityId: id,
      action: "deactivate",
    });

    const days = await loadScheduleDays(supabase);
    return NextResponse.json({ ok: true, days });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to remove" },
      { status: 500 },
    );
  }
}
