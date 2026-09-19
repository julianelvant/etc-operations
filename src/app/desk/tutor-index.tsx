"use client";

import { useEffect, useRef } from "react";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

type Props = {
  query: string;
  onQueryChange: (value: string) => void;
  letter: string | null;
  onLetterChange: (letter: string | null) => void;
  activeLetters: Set<string>;
  onCheckIn: () => void;
  onAddStudent: () => void;
};

export function TutorIndex({
  query,
  onQueryChange,
  letter,
  onLetterChange,
  activeLetters,
  onCheckIn,
  onAddStudent,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
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

  return (
    <div className="sticky top-0 z-20 border-b border-slate-200 bg-[#f3f5f7]/95 backdrop-blur">
      <div className="flex flex-col gap-3 px-4 py-3 lg:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search tutors by name or course</span>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search name or course  (press /)"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              autoComplete="off"
            />
          </label>
          <button
            type="button"
            onClick={onCheckIn}
            className="hidden min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:inline-flex sm:items-center"
          >
            Walk-in
          </button>
          <button
            type="button"
            onClick={onAddStudent}
            className="hidden min-h-11 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:inline-flex sm:items-center"
          >
            Add student
          </button>
        </div>

        <div
          role="group"
          aria-label="Filter roster by first letter"
          className="flex gap-1 overflow-x-auto pb-0.5"
        >
          <button
            type="button"
            onClick={() => onLetterChange(null)}
            aria-pressed={letter === null}
            className={`inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
              letter === null
                ? "bg-emerald-600 text-white"
                : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            All
          </button>
          {LETTERS.map((L) => {
            const has = activeLetters.has(L);
            const selected = letter === L;
            return (
              <button
                key={L}
                type="button"
                disabled={!has}
                onClick={() => onLetterChange(selected ? null : L)}
                aria-label={`Tutors starting with ${L}`}
                aria-pressed={selected}
                className={`inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-default disabled:opacity-30 ${
                  selected
                    ? "bg-emerald-600 text-white"
                    : has
                      ? "bg-white text-slate-700 hover:bg-slate-100"
                      : "bg-transparent text-slate-300"
                }`}
              >
                {L}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
