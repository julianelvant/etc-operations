import type { ShiftStatus } from "@/lib/schedule";

const styles: Record<ShiftStatus, string> = {
  late: "bg-[var(--status-late-bg)] text-[var(--status-late-ink)] border-[var(--status-late-border)]",
  due: "bg-[var(--status-due-bg)] text-[var(--status-due-ink)] border-[var(--status-due-border)]",
  upcoming:
    "bg-[var(--status-done-bg)] text-[var(--status-done-ink)] border-[var(--status-done-border)]",
  done: "bg-[var(--status-done-bg)] text-[var(--status-done-ink)] border-[var(--status-done-border)]",
  here: "bg-[var(--status-here-bg)] text-[var(--status-here-ink)] border-[var(--status-here-border)]",
};

const labels: Record<ShiftStatus, string> = {
  late: "Late",
  due: "Due",
  upcoming: "Upcoming",
  done: "Done",
  here: "Here",
};

export function StatusPill({ status }: { status: ShiftStatus }) {
  return (
    <span
      className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${styles[status]}`}
      aria-label={`Status: ${labels[status].toLowerCase()}`}
    >
      {labels[status]}
    </span>
  );
}
