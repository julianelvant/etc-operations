"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import type { TutorRow } from "@/lib/attendance";
import {
  getMergedShiftsForDay,
  type MergedShift,
} from "@/lib/schedule";
import type { SlotMap, WeekDay } from "./desk-types";
import { NowClock } from "./now-clock";

type SearchHit = {
  key: string;
  name: string;
  courses: string[];
  shift?: MergedShift;
  tutor?: TutorRow;
};

type Props = {
  date: string;
  today: string;
  isToday: boolean;
  week: WeekDay[];
  slots: SlotMap;
  tutors: TutorRow[];
  checkedInIds: Set<string>;
  onCheckIn: (tutor: TutorRow, scheduledShift?: string) => void;
  onWalkIn: () => void;
  onAddStudent: () => void;
  isPending: (key: string) => boolean;
};

export function OpsBar({
  date,
  today,
  isToday,
  week,
  slots,
  tutors,
  checkedInIds,
  onCheckIn,
  onWalkIn,
  onAddStudent,
  isPending,
}: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const nameToTutor = useMemo(() => {
    const map = new Map<string, TutorRow>();
    for (const t of tutors) map.set(t.name.toLowerCase(), t);
    return map;
  }, [tutors]);

  const shifts = useMemo(() => getMergedShiftsForDay(slots), [slots]);

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as SearchHit[];

    const fromSchedule: SearchHit[] = shifts
      .map((shift) => ({
        key: `s-${shift.name}-${shift.shiftLabel}`,
        name: shift.name,
        courses: shift.courses,
        shift,
        tutor: nameToTutor.get(shift.name.toLowerCase()),
      }))
      .filter((h) => {
        if (h.name.toLowerCase().includes(q)) return true;
        return h.courses.some((c) => c.toLowerCase().includes(q));
      });

    const scheduledNames = new Set(
      fromSchedule.map((h) => h.name.toLowerCase()),
    );
    const walkIns: SearchHit[] = tutors
      .filter((t) => !scheduledNames.has(t.name.toLowerCase()))
      .filter((t) => {
        if (t.name.toLowerCase().includes(q)) return true;
        return t.courses.some((c) => c.toLowerCase().includes(q));
      })
      .map((t) => ({
        key: `t-${t.id}`,
        name: t.name,
        courses: t.courses,
        tutor: t,
      }));

    return [...fromSchedule, ...walkIns].slice(0, 8);
  }, [query, shifts, nameToTutor, tutors]);

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const editable =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target?.isContentEditable;
      if (e.key === "/" && !editable) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setQuery("");
    setOpen(false);
  }, [date]);

  function selectHit(hit: SearchHit) {
    if (!hit.tutor) return;
    if (checkedInIds.has(hit.tutor.id)) return;
    onCheckIn(hit.tutor, hit.shift?.shiftLabel);
    setQuery("");
    setOpen(false);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (hits[active]) selectHit(hits[active]);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open && hits.length) setOpen(true);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(0, hits.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div className="border-b border-border bg-bg/95 backdrop-blur">
      <div className="flex flex-col gap-3 px-4 py-3 lg:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => router.push("/desk")}
              className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold focus-ring ${
                isToday
                  ? "bg-brand text-white"
                  : "border border-border bg-surface text-ink hover:bg-slate-50"
              }`}
              aria-current={isToday ? "date" : undefined}
            >
              Today
            </button>
            <label className="sr-only" htmlFor="desk-date">
              Choose date
            </label>
            <input
              id="desk-date"
              type="date"
              value={date}
              onChange={(e) => {
                if (e.target.value) router.push(`/desk?date=${e.target.value}`);
              }}
              className="input-field min-h-11 w-auto"
            />
            {isToday ? <NowClock isToday={isToday} /> : null}
          </div>

          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onWalkIn} className="btn-secondary">
              Walk-in
            </button>
            <button type="button" onClick={onAddStudent} className="btn-primary">
              Add student
            </button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="relative">
          <label className="block">
            <span className="sr-only">Search tutors by name or course</span>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
                setActive(0);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => window.setTimeout(() => setOpen(false), 150)}
              onKeyDown={onKeyDown}
              placeholder="Search name or course — press / then Enter to check in"
              className="input-field py-3 text-base"
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={open && hits.length > 0}
              aria-controls="ops-search-results"
            />
          </label>
          {open && hits.length > 0 ? (
            <ul
              id="ops-search-results"
              role="listbox"
              className="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
            >
              {hits.map((hit, i) => {
                const inNow = hit.tutor
                  ? checkedInIds.has(hit.tutor.id)
                  : false;
                const pending = hit.tutor
                  ? isPending(`in:${hit.tutor.id}`)
                  : false;
                return (
                  <li key={hit.key} role="option" aria-selected={i === active}>
                    <button
                      type="button"
                      disabled={!hit.tutor || inNow || pending || !isToday}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectHit(hit)}
                      className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left focus-ring disabled:opacity-50 ${
                        i === active ? "bg-brand-soft" : "hover:bg-bg"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink">
                          {hit.name}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {hit.shift
                            ? hit.shift.shiftLabel
                            : "Walk-in · not on schedule"}
                          {hit.courses[0] ? ` · ${hit.courses[0]}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-brand-ink">
                        {inNow ? "Here" : "Check in"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </form>

        <div
          className="flex gap-1 overflow-x-auto pb-0.5"
          role="navigation"
          aria-label="Week"
        >
          {week.map((d) => {
            const selected = d.date === date;
            const isTodayCell = d.date === today;
            return (
              <button
                key={d.date}
                type="button"
                onClick={() => router.push(`/desk?date=${d.date}`)}
                aria-current={selected ? "date" : undefined}
                aria-label={`${d.label} ${d.dayNum}${isTodayCell ? ", today" : ""}${d.tutorCount ? `, ${d.tutorCount} tutors` : ""}`}
                className={`inline-flex min-h-10 min-w-[2.75rem] flex-col items-center justify-center rounded-lg px-1.5 text-center text-xs focus-ring ${
                  selected
                    ? "bg-brand text-white"
                    : "bg-surface text-muted hover:bg-slate-100"
                }`}
              >
                <span className="font-medium uppercase opacity-80">
                  {d.label}
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {d.dayNum}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
