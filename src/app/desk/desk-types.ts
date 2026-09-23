import type {
  StudentVisitRow,
  TutorAttendanceRow,
  TutorRow,
} from "@/lib/attendance";
import type { CalendarRecurringRow } from "@/lib/calendar-recurring";
import type { ShiftRole } from "@/lib/schedule";

export type SlotMap = Record<
  string,
  { name: string; courses: string[]; role?: ShiftRole }[]
>;

export type WeekDay = {
  date: string;
  dayKey: string;
  label: string;
  dayNum: number;
  tutorCount: number;
};

export type DeskPanel = "none" | "student" | "tutor";

export type DeskClientProps = {
  date: string;
  today: string;
  dayKey: string;
  isToday: boolean;
  slots: SlotMap;
  recurring: CalendarRecurringRow[];
  week: WeekDay[];
  tutors: TutorRow[];
  initialAttendance: TutorAttendanceRow[];
  initialVisits: StudentVisitRow[];
};
