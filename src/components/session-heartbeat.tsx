"use client";

import { useEffect } from "react";

/** Keep desk_sessions.last_seen_at fresh while the tab is open. */
export function SessionHeartbeat() {
  useEffect(() => {
    let cancelled = false;

    async function beat() {
      if (cancelled || document.hidden) return;
      try {
        await fetch("/api/session/heartbeat", { method: "POST" });
      } catch {
        // ignore
      }
    }

    void beat();
    const id = window.setInterval(beat, 60_000);
    const onVis = () => {
      if (!document.hidden) void beat();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return null;
}
