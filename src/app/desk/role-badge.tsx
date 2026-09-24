import type { ShiftRole } from "@/lib/schedule";

export function RoleBadge({ role }: { role: ShiftRole }) {
  if (role === "Tutor") return null;
  const tone =
    role === "TA"
      ? "bg-slate-700 text-white"
      : role === "Coordinator"
        ? "bg-brand/15 text-brand-ink"
        : "bg-slate-100 text-slate-700";
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`}
    >
      {role}
    </span>
  );
}

export function cardRailClass(
  role: ShiftRole,
  status: "scheduled" | "here" | "done",
): string {
  if (status === "here") {
    return "border-l-[3px] border-l-[var(--status-here-border)]";
  }
  if (role === "TA") return "border-l-[3px] border-l-slate-600";
  if (role === "Coordinator") return "border-l-[3px] border-l-brand";
  return "border-l-[3px] border-l-transparent";
}
