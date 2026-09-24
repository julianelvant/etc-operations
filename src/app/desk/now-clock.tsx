"use client";

import { useEffect, useState } from "react";
import { beirutMinutes, TIMEZONE } from "@/lib/schedule";

function formatBeirutClock(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/** Isolated clock so the 30s tick does not re-render the whole desk. */
export function NowClock({
  isToday,
  compact = false,
}: {
  isToday: boolean;
  compact?: boolean;
}) {
  const [label, setLabel] = useState(() => formatBeirutClock(new Date()));
  const [mins, setMins] = useState(() =>
    beirutMinutes(new Date().toISOString()),
  );

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setLabel(formatBeirutClock(now));
      setMins(beirutMinutes(now.toISOString()));
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  if (!isToday) {
    return (
      <span className="text-sm text-muted">Viewing another day</span>
    );
  }

  const h = Math.floor(mins / 60);
  const quiet = h < 13 || h >= 18;

  if (compact) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-muted">
        <span
          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
          aria-hidden
        />
        <span className="font-medium tabular-nums text-ink">{label}</span>
      </span>
    );
  }

  return (
    <div className="min-w-0 text-sm">
      <p className="flex items-center gap-2 whitespace-nowrap text-ink">
        <span
          className="inline-block h-2 w-2 shrink-0 rounded-full bg-brand"
          aria-hidden
        />
        <span className="font-medium tabular-nums">Now {label}</span>
        <span className="text-muted">· Beirut</span>
      </p>
      {quiet ? (
        <p className="mt-1">
          <span className="inline-flex rounded-md border border-border bg-bg px-2 py-0.5 text-xs text-muted">
            Outside tutoring hours
          </span>
        </p>
      ) : null}
    </div>
  );
}
