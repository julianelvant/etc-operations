"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays } from "@/lib/schedule";
import type { WeekDay } from "./desk-types";
import { NowClock } from "./now-clock";

type Props = {
  date: string;
  today: string;
  isToday: boolean;
  week: WeekDay[];
  onCheckIn: () => void;
  onAddStudent: () => void;
};

export function WeekStrip({
  date,
  today,
  isToday,
  week,
  onCheckIn,
  onAddStudent,
}: Props) {
  const router = useRouter();

  function goToDate(next: string) {
    router.push(`/desk?date=${next}`);
  }

  return (
    <div className="border-b border-slate-200 bg-white px-4 py-3 lg:px-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => goToDate(addDays(date, -7))}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            aria-label="Previous week"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => router.push("/desk")}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => goToDate(addDays(date, 7))}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            aria-label="Next week"
          >
            ›
          </button>
          {!isToday ? (
            <Link
              href={`/desk?date=${today}`}
              className="ml-1 text-sm font-semibold text-emerald-700 hover:underline"
            >
              Jump to today
            </Link>
          ) : (
            <span className="ml-1">
              <NowClock isToday={isToday} />
            </span>
          )}
        </div>
        <div className="flex gap-2 lg:hidden">
          <button
            type="button"
            onClick={onCheckIn}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold"
          >
            Check in
          </button>
          <button
            type="button"
            onClick={onAddStudent}
            className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
          >
            Student
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {week.map((d) => {
          const selected = d.date === date;
          const isTodayCell = d.date === today;
          return (
            <button
              key={d.date}
              type="button"
              onClick={() => goToDate(d.date)}
              className={`rounded-2xl px-1 py-2.5 text-center transition ${
                selected
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-200"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <div className="text-[10px] font-semibold uppercase opacity-80">
                {d.label}
              </div>
              <div className="font-display text-lg font-semibold">
                {d.dayNum}
              </div>
              <div
                className={`mt-0.5 text-[10px] ${
                  selected ? "text-emerald-100" : "text-slate-400"
                }`}
              >
                {d.tutorCount ? `${d.tutorCount} on` : "—"}
              </div>
              {isTodayCell && !selected ? (
                <div className="mx-auto mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
