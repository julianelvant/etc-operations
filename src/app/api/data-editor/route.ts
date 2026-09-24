import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { beirutDateTimeFromInput } from "@/lib/beirut-datetime";
import { requireAudit } from "@/lib/data/backups";
import {
  ensureTutorIdByName,
  fetchEditorData,
} from "@/lib/data-editor";
import { getBeirutParts, hoursBetween, minutesBetween } from "@/lib/schedule";
import { createWriteClient } from "@/lib/supabase/write";

function parseRange(url: URL): { from: string; to: string } | null {
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return null;
  }
  if (from > to) return null;
  return { from, to };
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const range = parseRange(new URL(request.url));
  if (!range) {
    return NextResponse.json(
      { error: "from and to required (YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  try {
    const supabase = await createWriteClient();
    const data = await fetchEditorData(supabase, range.from, range.to);
    return NextResponse.json({ ...range, ...data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = String(body.action ?? "");
  const supabase = await createWriteClient();

  try {
    if (action === "save_tutor") {
      return await saveTutorRow(supabase, session.username, body.row);
    }
    if (action === "save_visit") {
      return await saveVisitRow(supabase, session.username, body.row);
    }
    if (action === "delete_tutor") {
      return await deleteTutorRow(supabase, session.username, String(body.id ?? ""));
    }
    if (action === "delete_visit") {
      return await deleteVisitRow(supabase, session.username, String(body.id ?? ""));
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

function resolveEditorDate(raw: string): string {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return getBeirutParts().date;
}

async function saveTutorRow(
  supabase: Awaited<ReturnType<typeof createWriteClient>>,
  actor: string,
  row: Record<string, unknown>,
) {
  const date = resolveEditorDate(String(row.date ?? ""));
  const tutorName = String(row.tutorName ?? "").trim();
  const scheduledShift = String(row.scheduledShift ?? "").trim();
  const role = String(row.role ?? "Tutor").trim() || "Tutor";
  const notes = String(row.notes ?? "");
  const timeInStr = String(row.timeIn ?? "");
  const timeOutStr = String(row.timeOut ?? "");
  const id = row.id ? String(row.id) : "";

  const tutorId = await ensureTutorIdByName(supabase, tutorName);

  const timeIn = beirutDateTimeFromInput(date, timeInStr);
  const timeOut = timeOutStr.trim()
    ? beirutDateTimeFromInput(date, timeOutStr)
    : null;
  const totalHours =
    timeOut && new Date(timeOut).getTime() >= new Date(timeIn).getTime()
      ? hoursBetween(timeIn, timeOut)
      : null;

  if (id) {
    const { data: existing } = await supabase
      .from("tutor_attendance")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    const { data, error } = await supabase
      .from("tutor_attendance")
      .update({
        attendance_date: date,
        tutor_id: tutorId,
        scheduled_shift: scheduledShift,
        role,
        time_in: timeIn,
        time_out: timeOut,
        total_hours: totalHours,
        notes,
      })
      .eq("id", id)
      .select(
        "id, attendance_date, tutor_id, scheduled_shift, role, time_in, time_out, total_hours, notes, tutors(id, name)",
      )
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await requireAudit(supabase, {
      actor,
      entity: "tutor_attendance",
      entityId: id,
      action: "update",
      before: existing,
      after: data,
    });

    return NextResponse.json({ ok: true, row: data });
  }

  const { data, error } = await supabase
    .from("tutor_attendance")
    .insert({
      attendance_date: date,
      tutor_id: tutorId,
      scheduled_shift: scheduledShift,
      role,
      time_in: timeIn,
      time_out: timeOut,
      total_hours: totalHours,
      notes,
      created_by: actor,
    })
    .select(
      "id, attendance_date, tutor_id, scheduled_shift, role, time_in, time_out, total_hours, notes, tutors(id, name)",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await requireAudit(supabase, {
    actor,
    entity: "tutor_attendance",
    entityId: data.id,
    action: "insert",
    after: data,
  });

  return NextResponse.json({ ok: true, row: data });
}

async function saveVisitRow(
  supabase: Awaited<ReturnType<typeof createWriteClient>>,
  actor: string,
  row: Record<string, unknown>,
) {
  const date = resolveEditorDate(String(row.date ?? ""));
  const studentName = String(row.studentName ?? "").trim() || "Unnamed";
  const studentEmail = String(row.studentEmail ?? "").trim();
  const course = String(row.course ?? "").trim();
  const notes = String(row.notes ?? "");
  const tutorName = String(row.tutorName ?? "").trim();
  const timeInStr = String(row.timeIn ?? "");
  const timeOutStr = String(row.timeOut ?? "");
  const id = row.id ? String(row.id) : "";

  let tutorId: string | null = null;
  if (tutorName) {
    tutorId = await ensureTutorIdByName(supabase, tutorName);
  }

  const timeIn = beirutDateTimeFromInput(date, timeInStr);
  const timeOut = timeOutStr.trim()
    ? beirutDateTimeFromInput(date, timeOutStr)
    : null;
  const durationMinutes =
    timeOut && new Date(timeOut).getTime() >= new Date(timeIn).getTime()
      ? minutesBetween(timeIn, timeOut)
      : null;

  const payload = {
    visit_date: date,
    student_name: studentName,
    student_email: studentEmail,
    time_in: timeIn,
    time_out: timeOut,
    duration_minutes: durationMinutes,
    course,
    tutor_id: tutorId,
    notes,
  };

  if (id) {
    const { data: existing } = await supabase
      .from("student_visits")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    const { data, error } = await supabase
      .from("student_visits")
      .update(payload)
      .eq("id", id)
      .select(
        "id, visit_date, student_name, student_email, time_in, time_out, duration_minutes, course, tutor_id, notes, tutors(id, name)",
      )
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await requireAudit(supabase, {
      actor,
      entity: "student_visits",
      entityId: id,
      action: "update",
      before: existing,
      after: data,
    });

    return NextResponse.json({ ok: true, row: data });
  }

  const { data, error } = await supabase
    .from("student_visits")
    .insert({ ...payload, created_by: actor })
    .select(
      "id, visit_date, student_name, student_email, time_in, time_out, duration_minutes, course, tutor_id, notes, tutors(id, name)",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await requireAudit(supabase, {
    actor,
    entity: "student_visits",
    entityId: data.id,
    action: "insert",
    after: data,
  });

  return NextResponse.json({ ok: true, row: data });
}

async function deleteTutorRow(
  supabase: Awaited<ReturnType<typeof createWriteClient>>,
  actor: string,
  id: string,
) {
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const { data: existing } = await supabase
    .from("tutor_attendance")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("tutor_attendance").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await requireAudit(supabase, {
    actor,
    entity: "tutor_attendance",
    entityId: id,
    action: "deactivate",
    before: existing,
  });

  return NextResponse.json({ ok: true });
}

async function deleteVisitRow(
  supabase: Awaited<ReturnType<typeof createWriteClient>>,
  actor: string,
  id: string,
) {
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const { data: existing } = await supabase
    .from("student_visits")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("student_visits").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await requireAudit(supabase, {
    actor,
    entity: "student_visits",
    entityId: id,
    action: "deactivate",
    before: existing,
  });

  return NextResponse.json({ ok: true });
}
