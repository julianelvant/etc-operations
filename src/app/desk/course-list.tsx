"use client";

import { useState } from "react";

type Props = {
  courses: string[];
  maxVisible?: number;
  className?: string;
};

export function CourseList({
  courses,
  maxVisible = 6,
  className = "",
}: Props) {
  const [expanded, setExpanded] = useState(false);

  if (courses.length === 0) return null;

  const visible = expanded ? courses : courses.slice(0, maxVisible);
  const hiddenCount = courses.length - maxVisible;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {visible.map((course) => (
        <span
          key={course}
          className="inline-flex max-w-full break-words rounded-md border border-border bg-bg px-2 py-0.5 text-xs text-muted"
        >
          {course}
        </span>
      ))}
      {!expanded && hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-xs font-semibold text-brand-ink hover:underline focus-ring rounded"
        >
          {hiddenCount} more course{hiddenCount === 1 ? "" : "s"}
        </button>
      ) : null}
      {expanded && hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-xs font-medium text-muted hover:underline focus-ring rounded"
        >
          Show less
        </button>
      ) : null}
    </div>
  );
}
