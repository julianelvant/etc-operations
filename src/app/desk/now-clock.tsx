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
export function NowClock({ isToday }: { isToday: boolean }) {
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
      <span className="text-sm text-slate-500">Viewing another day</span>
    );
  }

  const h = Math.floor(mins / 60);
  const quiet = h < 13 || h >= 18;

  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-600">
      <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      <span className="font-medium text-slate-800">Now {label}</span>
      <span className="text-slate-400">Beirut</span>
      {quiet ? (
        <span className="text-slate-400">· outside tutoring hours</span>
      ) : null}
    </span>
  );
}
