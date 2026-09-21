import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  getBeirutParts,
  getScheduledShiftForTutor,
  hoursBetween,
} from "@/lib/schedule";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  const date =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : getBeirutParts().date;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tutor_attendance")
    .select(
      "id, attendance_date, tutor_id, scheduled_shift, role, time_in, time_out, total_hours, notes, tutors(id, name, courses)",
    )
    .eq("attendance_date", date)
    .order("time_in", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []).map((row) => {
    const tutors = Array.isArray(row.tutors) ? row.tutors[0] : row.tutors;
    return { ...row, tutors: tutors ?? null };
  });

  return NextResponse.json({ date, rows });
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

  const action = body.action as string;
  const supabase = await createClient();
  const { date, dayKey } = getBeirutParts();
  const now = new Date().toISOString();

  if (action === "check_in") {
    const tutorId = String(body.tutorId ?? "");
    const notes = String(body.notes ?? "");
    const role = String(body.role ?? "Tutor").trim() || "Tutor";
    if (!tutorId) {
      return NextResponse.json({ error: "tutorId required" }, { status: 400 });
    }

    const { data: tutor, error: tutorError } = await supabase
      .from("tutors")
      .select("id, name")
      .eq("id", tutorId)
      .single();
    if (tutorError || !tutor) {
      return NextResponse.json({ error: "Tutor not found" }, { status: 404 });
    }

    // Prevent duplicate open check-in for same tutor same day
    const { data: open } = await supabase
      .from("tutor_attendance")
      .select("id")
      .eq("attendance_date", date)
      .eq("tutor_id", tutorId)
      .is("time_out", null)
      .maybeSingle();
    if (open) {
      return NextResponse.json(
        { error: "Tutor already checked in" },
        { status: 409 },
      );
    }

    const scheduledShift =
      String(body.scheduledShift ?? "") ||
      getScheduledShiftForTutor(tutor.name, dayKey);

    const { data, error } = await supabase
      .from("tutor_attendance")
      .insert({
        attendance_date: date,
        tutor_id: tutorId,
        scheduled_shift: scheduledShift,
        role,
        time_in: now,
        notes,
        created_by: session.username,
      })
      .select(
        "id, attendance_date, tutor_id, scheduled_shift, role, time_in, time_out, total_hours, notes, tutors(id, name, courses)",
      )
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ row: data });
  }

  if (action === "check_out") {
    const id = String(body.id ?? "");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const { data: existing, error: findError } = await supabase
      .from("tutor_attendance")
      .select("id, time_in, time_out")
      .eq("id", id)
      .single();
    if (findError || !existing) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }
    if (existing.time_out) {
      return NextResponse.json({ error: "Already checked out" }, { status: 409 });
    }

    const totalHours = hoursBetween(existing.time_in, now);
    const { data, error } = await supabase
      .from("tutor_attendance")
      .update({ time_out: now, total_hours: totalHours })
      .eq("id", id)
      .select(
        "id, attendance_date, tutor_id, scheduled_shift, role, time_in, time_out, total_hours, notes, tutors(id, name, courses)",
      )
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ row: data });
  }

  if (action === "update_notes" || action === "update") {
    const id = String(body.id ?? "");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const patch: { notes?: string; role?: string } = {};
    if (body.notes !== undefined) patch.notes = String(body.notes);
    if (body.role !== undefined) {
      patch.role = String(body.role).trim() || "Tutor";
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "notes or role required" },
        { status: 400 },
      );
    }
    const { data, error } = await supabase
      .from("tutor_attendance")
      .update(patch)
      .eq("id", id)
      .select(
        "id, attendance_date, tutor_id, scheduled_shift, role, time_in, time_out, total_hours, notes, tutors(id, name, courses)",
      )
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ row: data });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
