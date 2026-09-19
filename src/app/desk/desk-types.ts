import type {
  StudentVisitRow,
  TutorAttendanceRow,
  TutorRow,
} from "@/lib/attendance";

export type SlotMap = Record<string, { name: string; courses: string[] }[]>;

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
  week: WeekDay[];
  tutors: TutorRow[];
  initialAttendance: TutorAttendanceRow[];
  initialVisits: StudentVisitRow[];
};
