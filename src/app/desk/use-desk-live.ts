"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  StudentVisitRow,
  TutorAttendanceRow,
  TutorRow,
} from "@/lib/attendance";
import { beirutMinutes } from "@/lib/schedule";
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
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState<DeskPanel>("none");
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [defaultTutorId, setDefaultTutorId] = useState("");
  const [nowMin, setNowMin] = useState(() =>
    beirutMinutes(new Date().toISOString()),
  );
  const knownIds = useRef(new Set(initialAttendance.map((a) => a.id)));
  const attFp = useRef(attendanceFingerprint(initialAttendance));
  const visFp = useRef(visitsFingerprint(initialVisits));

  const setPending = useCallback((key: string, on: boolean) => {
    setPendingKeys((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const isPending = useCallback(
    (key: string) => pendingKeys.has(key),
    [pendingKeys],
  );

  const flash = useCallback((msg: string) => {
    setError(null);
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  const setErrorMsg = useCallback((msg: string) => {
    setToast(null);
    setError(msg);
    window.setTimeout(() => setError(null), 5000);
  }, []);

  useEffect(() => {
    setAttendance(initialAttendance);
    setVisits(initialVisits);
    knownIds.current = new Set(initialAttendance.map((a) => a.id));
    attFp.current = attendanceFingerprint(initialAttendance);
    visFp.current = visitsFingerprint(initialVisits);
  }, [initialAttendance, initialVisits, date]);

  // Live Beirut clock minutes for due/late buckets
  useEffect(() => {
    const tick = () => setNowMin(beirutMinutes(new Date().toISOString()));
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const poll = useCallback(async () => {
    if (!isToday || document.hidden) return;
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
  }, [date, isToday, flash]);

  useEffect(() => {
    if (!isToday) return;
    const id = window.setInterval(poll, 25_000);
    const onVis = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [isToday, poll]);

  const checkedInIds = useMemo(
    () => new Set(attendance.filter((a) => !a.time_out).map((a) => a.tutor_id)),
    [attendance],
  );

  const openTutors = useMemo(
    () => attendance.filter((a) => !a.time_out),
    [attendance],
  );

  const closedIntervals = useMemo(
    () =>
      attendance
        .filter((a) => a.time_out)
        .map((a) => ({
          tutorId: a.tutor_id,
          tutorNameLower: a.tutors?.name?.toLowerCase(),
          timeInMin: beirutMinutes(a.time_in),
          timeOutMin: beirutMinutes(a.time_out!),
        })),
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

  async function checkInTutor(
    tutor: TutorRow,
    scheduledShift?: string,
    opts?: { notes?: string; role?: string },
  ) {
    if (!isToday) {
      setErrorMsg("Switch to today to check someone in.");
      return;
    }
    if (checkedInIds.has(tutor.id)) {
      setErrorMsg(`${tutor.name} is already checked in.`);
      return;
    }
    const key = `in:${tutor.id}`;
    setPending(key, true);
    try {
      const { row } = await api("/api/attendance/tutors", {
        action: "check_in",
        tutorId: tutor.id,
        scheduledShift: scheduledShift ?? "",
        notes: opts?.notes ?? "",
        role: opts?.role ?? "Tutor",
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
      setErrorMsg(e instanceof Error ? e.message : "Check-in failed");
    } finally {
      setPending(key, false);
    }
  }

  async function updateTutorMeta(
    id: string,
    patch: { notes?: string; role?: string },
  ) {
    const key = `meta:${id}`;
    setPending(key, true);
    try {
      const { row: updated } = await api("/api/attendance/tutors", {
        action: "update",
        id,
        ...patch,
      });
      setAttendance((prev) => {
        const next = prev.map((r) => (r.id === id ? updated : r));
        attFp.current = attendanceFingerprint(next);
        return next;
      });
      flash("Saved");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Update failed");
    } finally {
      setPending(key, false);
    }
  }

  async function checkOutTutor(id: string, opts?: { force?: boolean }) {
    const open = visits.filter((v) => !v.time_out && v.tutor_id);
    const row = attendance.find((a) => a.id === id);
    const openForTutor = open.filter((v) => v.tutor_id === row?.tutor_id);
    if (!opts?.force && openForTutor.length > 0) {
      const ok = window.confirm(
        `${row?.tutors?.name ?? "Tutor"} still has ${openForTutor.length} open student${openForTutor.length === 1 ? "" : "s"}. Check out anyway?`,
      );
      if (!ok) return;
    }
    const key = `out:${id}`;
    setPending(key, true);
    try {
      const { row: updated } = await api("/api/attendance/tutors", {
        action: "check_out",
        id,
      });
      setAttendance((prev) => {
        const next = prev.map((r) => (r.id === id ? updated : r));
        attFp.current = attendanceFingerprint(next);
        return next;
      });
      flash("Tutor checked out");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Check-out failed");
    } finally {
      setPending(key, false);
    }
  }

  async function addStudent(payload: {
    studentName: string;
    studentEmail: string;
    course: string;
    tutorId: string;
    studentNotes: string;
  }) {
    if (!isToday) {
      setErrorMsg("Switch to today to log a student.");
      return;
    }
    const key = "student:add";
    setPending(key, true);
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
      setErrorMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setPending(key, false);
    }
  }

  async function checkOutStudent(id: string) {
    const key = `sout:${id}`;
    setPending(key, true);
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
      setErrorMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setPending(key, false);
    }
  }

  return {
    attendance,
    visits,
    toast,
    error,
    panel,
    setPanel,
    highlightId,
    defaultTutorId,
    checkedInIds,
    openTutors,
    closedIntervals,
    visitsByTutorId,
    openStudentCount,
    nowMin,
    isPending,
    flash,
    openStudentPanel,
    openTutorPanel,
    checkInTutor,
    checkOutTutor,
    updateTutorMeta,
    addStudent,
    checkOutStudent,
  };
}
