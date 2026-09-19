"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import type {
  StudentVisitRow,
  TutorAttendanceRow,
  TutorRow,
} from "@/lib/attendance";
import type { DeskPanel } from "./desk-types";

function attendanceFingerprint(rows: TutorAttendanceRow[]) {
  return rows.map((r) => `${r.id}:${r.time_out ?? ""}`).join("|");
}

function visitsFingerprint(rows: StudentVisitRow[]) {
  return rows
    .map((r) => `${r.id}:${r.time_out ?? ""}:${r.tutor_id ?? ""}`)
    .join("|");
}

async function api(path: string, body: unknown) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

export function useDeskLive({
  date,
  isToday,
  initialAttendance,
  initialVisits,
}: {
  date: string;
  isToday: boolean;
  initialAttendance: TutorAttendanceRow[];
  initialVisits: StudentVisitRow[];
}) {
  const [attendance, setAttendance] = useState(initialAttendance);
  const [visits, setVisits] = useState(initialVisits);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [panel, setPanel] = useState<DeskPanel>("none");
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [defaultTutorId, setDefaultTutorId] = useState("");
  const knownIds = useRef(new Set(initialAttendance.map((a) => a.id)));
  const attFp = useRef(attendanceFingerprint(initialAttendance));
  const visFp = useRef(visitsFingerprint(initialVisits));

  const flash = useCallback((msg: string) => {
    setError(null);
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => {
    setAttendance(initialAttendance);
    setVisits(initialVisits);
    knownIds.current = new Set(initialAttendance.map((a) => a.id));
    attFp.current = attendanceFingerprint(initialAttendance);
    visFp.current = visitsFingerprint(initialVisits);
  }, [initialAttendance, initialVisits, date]);

  // Soft poll — skip setState when payload unchanged
  useEffect(() => {
    if (!isToday) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/attendance/tutors?date=${date}`);
        if (!res.ok) return;
        const json = await res.json();
        const rows = (json.rows ?? []) as TutorAttendanceRow[];
        for (const row of rows) {
          if (!knownIds.current.has(row.id)) {
            knownIds.current.add(row.id);
            setHighlightId(row.id);
            flash(`${row.tutors?.name ?? "Tutor"} just arrived`);
            window.setTimeout(() => setHighlightId(null), 4000);
          }
        }
        const nextAtt = attendanceFingerprint(rows);
        if (nextAtt !== attFp.current) {
          attFp.current = nextAtt;
          setAttendance(rows);
        }
        const vRes = await fetch(`/api/attendance/students?date=${date}`);
        if (vRes.ok) {
          const vJson = await vRes.json();
          const vRows = (vJson.rows ?? []) as StudentVisitRow[];
          const nextVis = visitsFingerprint(vRows);
          if (nextVis !== visFp.current) {
            visFp.current = nextVis;
            setVisits(vRows);
          }
        }
      } catch {
        // ignore poll errors
      }
    };
    const id = window.setInterval(poll, 25_000);
    return () => window.clearInterval(id);
  }, [date, isToday, flash]);

  const checkedInIds = useMemo(
    () => new Set(attendance.filter((a) => !a.time_out).map((a) => a.tutor_id)),
    [attendance],
  );

  const openTutors = useMemo(
    () => attendance.filter((a) => !a.time_out),
    [attendance],
  );

  const closedTutorIds = useMemo(
    () => new Set(attendance.filter((a) => a.time_out).map((a) => a.tutor_id)),
    [attendance],
  );

  const visitsByTutorId = useMemo(() => {
    const map = new Map<string, StudentVisitRow[]>();
    for (const v of visits) {
      if (!v.tutor_id) continue;
      const list = map.get(v.tutor_id);
      if (list) list.push(v);
      else map.set(v.tutor_id, [v]);
    }
    return map;
  }, [visits]);

  const openStudentCount = useMemo(
    () => visits.filter((v) => !v.time_out).length,
    [visits],
  );

  function openStudentPanel(tutorId?: string) {
    setDefaultTutorId(tutorId ?? openTutors[0]?.tutor_id ?? "");
    setPanel("student");
  }

  function openTutorPanel() {
    setPanel("tutor");
  }

  function checkInTutor(tutor: TutorRow, scheduledShift?: string) {
    if (!isToday) {
      setError("Switch to today to check someone in.");
      return;
    }
    if (checkedInIds.has(tutor.id)) {
      setError(`${tutor.name} is already checked in.`);
      return;
    }
    startTransition(async () => {
      try {
        const { row } = await api("/api/attendance/tutors", {
          action: "check_in",
          tutorId: tutor.id,
          scheduledShift: scheduledShift ?? "",
        });
        knownIds.current.add(row.id);
        setAttendance((prev) => {
          const next = [...prev, row];
          attFp.current = attendanceFingerprint(next);
          return next;
        });
        setHighlightId(row.id);
        flash(`${tutor.name} checked in`);
        setPanel("none");
        window.setTimeout(() => setHighlightId(null), 4000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Check-in failed");
      }
    });
  }

  function checkOutTutor(id: string) {
    startTransition(async () => {
      try {
        const { row } = await api("/api/attendance/tutors", {
          action: "check_out",
          id,
        });
        setAttendance((prev) => {
          const next = prev.map((r) => (r.id === id ? row : r));
          attFp.current = attendanceFingerprint(next);
          return next;
        });
        flash("Tutor checked out");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Check-out failed");
      }
    });
  }

  function addStudent(payload: {
    studentName: string;
    studentEmail: string;
    course: string;
    tutorId: string;
    studentNotes: string;
  }) {
    if (!isToday) {
      setError("Switch to today to log a student.");
      return;
    }
    startTransition(async () => {
      try {
        const { row } = await api("/api/attendance/students", {
          action: "check_in",
          studentName: payload.studentName,
          studentEmail: payload.studentEmail,
          course: payload.course,
          tutorId: payload.tutorId || null,
          notes: payload.studentNotes,
        });
        setVisits((prev) => {
          const next = [...prev, row];
          visFp.current = visitsFingerprint(next);
          return next;
        });
        setPanel("none");
        flash(`${row.student_name} added`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  function checkOutStudent(id: string) {
    startTransition(async () => {
      try {
        const { row } = await api("/api/attendance/students", {
          action: "check_out",
          id,
        });
        setVisits((prev) => {
          const next = prev.map((r) => (r.id === id ? row : r));
          visFp.current = visitsFingerprint(next);
          return next;
        });
        flash("Student checked out");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  return {
    attendance,
    visits,
    toast,
    error,
    pending,
    panel,
    setPanel,
    highlightId,
    defaultTutorId,
    checkedInIds,
    openTutors,
    closedTutorIds,
    visitsByTutorId,
    openStudentCount,
    flash,
    openStudentPanel,
    openTutorPanel,
    checkInTutor,
    checkOutTutor,
    addStudent,
    checkOutStudent,
  };
}
