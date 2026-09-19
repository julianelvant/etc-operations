import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getBeirutParts, minutesBetween } from "@/lib/schedule";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { date } = getBeirutParts();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("student_visits")
    .select(
      "id, visit_date, student_name, student_email, time_in, time_out, duration_minutes, course, tutor_id, notes, tutors(id, name)",
    )
    .eq("visit_date", date)
    .order("time_in", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ date, rows: data ?? [] });
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
  const { date } = getBeirutParts();
  const now = new Date().toISOString();

  if (action === "check_in") {
    const studentName = String(body.studentName ?? "").trim();
    const studentEmail = String(body.studentEmail ?? "").trim();
    const course = String(body.course ?? "").trim();
    const tutorId = body.tutorId ? String(body.tutorId) : null;
    const notes = String(body.notes ?? "");

    if (!studentName) {
      return NextResponse.json(
        { error: "studentName required" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("student_visits")
      .insert({
        visit_date: date,
        student_name: studentName,
        student_email: studentEmail,
        time_in: now,
        course,
        tutor_id: tutorId,
        notes,
        created_by: session.username,
      })
      .select(
        "id, visit_date, student_name, student_email, time_in, time_out, duration_minutes, course, tutor_id, notes, tutors(id, name)",
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
      .from("student_visits")
      .select("id, time_in, time_out")
      .eq("id", id)
      .single();
    if (findError || !existing) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }
    if (existing.time_out) {
      return NextResponse.json({ error: "Already checked out" }, { status: 409 });
    }

    const duration = minutesBetween(existing.time_in, now);
    const { data, error } = await supabase
      .from("student_visits")
      .update({ time_out: now, duration_minutes: duration })
      .eq("id", id)
      .select(
        "id, visit_date, student_name, student_email, time_in, time_out, duration_minutes, course, tutor_id, notes, tutors(id, name)",
      )
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ row: data });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
